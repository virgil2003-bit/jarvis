import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { convert } from 'html-to-text';

export function safeMailDate(value){
 if(value===undefined||value===null||value==='')return null;
 const date=value instanceof Date?value:new Date(value);
 return Number.isFinite(date.getTime())?date.toISOString():null;
}
function cleanBody(value){return String(value||'').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim();}
function htmlBody(value){return convert(String(value||''),{wordwrap:false,limits:{maxInputLength:100000,maxDepth:40},selectors:[{selector:'a',options:{ignoreHref:true}},{selector:'img',format:'skip'},{selector:'script',format:'skip'},{selector:'style',format:'skip'},{selector:'noscript',format:'skip'}]});}

export function mailConfigured(env){return Boolean(env.ICLOUD_EMAIL?.trim()&&env.ICLOUD_APP_PASSWORD?.trim());}

// Fixed Apple endpoint, verified TLS, EXAMINE/read-only mailbox, no write commands.
export async function readRecentMail(env,{clientFactory=options=>new ImapFlow(options),parse=simpleParser,timeoutMs=20000}={}){
 if(!mailConfigured(env))throw new Error('MAIL_NOT_CONFIGURED');
 const client=clientFactory({host:'imap.mail.me.com',port:993,secure:true,tls:{rejectUnauthorized:true},auth:{user:env.ICLOUD_EMAIL.trim(),pass:env.ICLOUD_APP_PASSWORD.trim()},logger:false,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});
 client.on('error',()=>{});
 let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{client.close();reject(new Error('MAIL_TIMEOUT'))},timeoutMs)});
 async function read(){
 await client.connect();const lock=await client.getMailboxLock('INBOX',{readOnly:true});
 try{
 const count=client.mailbox.exists;
 if(!count)return [];
 const emails=[];
 for await(const item of client.fetch(`${Math.max(1,count-4)}:${count}`,{uid:true,envelope:true,flags:true,size:true,internalDate:true})){
 emails.push({uid:item.uid,subject:String(item.envelope?.subject||'(No subject)').slice(0,300),from:(item.envelope?.from||[]).slice(0,3).map(a=>({name:String(a.name||'').slice(0,150),address:String(a.address||'').slice(0,200)})),date:safeMailDate(item.envelope?.date),receivedAt:safeMailDate(item.internalDate),unread:!item.flags?.has('\\Seen'),size:item.size});
 }
 // Do not issue nested IMAP commands while iterating fetch (the iterator holds a lock).
 const small=emails.filter(email=>!(email.size>100000));
 const sources=new Map();
 if(small.length){
  // One bounded UID FETCH instead of one round trip per message body.
  for await(const item of client.fetch(small.map(email=>email.uid).join(','),{uid:true,source:{start:0,maxLength:100000}},{uid:true})){
   if(item.source)sources.set(item.uid,item.source);
  }
 }
 for(const email of emails){
 if(email.size>100000){email.text='Body omitted: message exceeds the 100 KB review limit.';email.bodyOmitted=true;email.bodyStatus='omitted_large';continue;}
 const source=sources.get(email.uid);
 if(!source){email.text='Body unavailable.';email.bodyStatus='missing';continue;}
 try{
 const parsed=await parse(source,{skipHtmlToText:true,skipTextToHtml:true,skipImageLinks:true});
 const plain=cleanBody(parsed.text);
 const body=plain||cleanBody(parsed.html?htmlBody(parsed.html):'');
 email.textSource=plain?'plain_text':body?'html_text':null;
 email.textTruncated=body.length>3500;
 email.bodyStatus=!body?'empty':email.textTruncated?'truncated':'available';
 email.text=body.slice(0,3500)||'No readable message body. Attachments are not opened.';
 }catch{
 // One malformed message must not prevent reviewing the remaining inbox.
 email.text='Body unavailable: this message could not be decoded.';email.bodyStatus='parse_failed';
 }
 }
 return emails.reverse();
 }finally{lock.release()}
 }
 try{return await Promise.race([read(),timeout])}finally{clearTimeout(timer);client.close()}
}

// Classify errors without returning Apple responses, credentials, or email content.
export function describeMailError(error){
 const code=String(error?.code||error?.serverResponseCode||'');
 if(error?.authenticationFailed||/AUTHENTICATIONFAILED|AUTHFAILED|EAUTH/i.test(code))return {code:'APPLE_LOGIN_REJECTED',message:'Apple rejected the iCloud login. In Render, check ICLOUD_EMAIL is your full iCloud Mail address and ICLOUD_APP_PASSWORD is the Apple app-specific password for that same account, not your Apple Account password.'};
 if(error?.message==='MAIL_NOT_CONFIGURED')return {code:'MAIL_NOT_CONFIGURED',message:'Add both ICLOUD_EMAIL and ICLOUD_APP_PASSWORD in Render Environment, then redeploy.'};
 if(error?.message==='MAIL_TIMEOUT'||/ETIMEDOUT|ETIMEOUT|ECONNECTIONTIMEOUT|ESOCKETTIMEDOUT/i.test(code))return {code:'APPLE_CONNECTION_TIMEOUT',message:'The server timed out connecting to Apple Mail. Check Render can reach imap.mail.me.com on port 993; this does not establish whether the password is valid.'};
 if(/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ENETUNREACH|EHOSTUNREACH|EPROXY/i.test(code))return {code:'APPLE_CONNECTION_FAILED',message:'The server could not reach Apple IMAP. Check hosting network access to imap.mail.me.com on port 993.'};
 if(/CERT|TLS|SSL/i.test(code))return {code:'APPLE_TLS_FAILED',message:'The secure connection to Apple Mail failed certificate verification. Do not disable TLS verification.'};
 return {code:'MAIL_READ_FAILED',message:'iCloud Mail could not be read. Check that iCloud Mail is enabled and the Render address and Apple app-specific password belong to the same account.'};
}
