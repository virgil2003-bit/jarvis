import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

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
 for await(const item of client.fetch(`${Math.max(1,count-4)}:${count}`,{uid:true,envelope:true,flags:true,size:true})){
 emails.push({uid:item.uid,subject:String(item.envelope?.subject||'(No subject)').slice(0,300),from:(item.envelope?.from||[]).slice(0,3).map(a=>({name:String(a.name||'').slice(0,150),address:String(a.address||'').slice(0,200)})),date:item.envelope?.date?.toISOString()||null,unread:!item.flags?.has('\\Seen'),size:item.size});
 }
 // Do not issue nested IMAP commands while iterating fetch (the iterator holds a lock).
 for(const email of emails){
 if(email.size>100000){email.text='Body omitted: message exceeds the 100 KB review limit.';email.bodyOmitted=true;continue;}
 const item=await client.fetchOne(email.uid,{source:{start:0,maxLength:100000}},{uid:true});
 if(!item?.source){email.text='Body unavailable.';continue;}
 const parsed=await parse(item.source,{skipHtmlToText:true,skipTextToHtml:true,skipImageLinks:true});
 email.text=parsed.text?.slice(0,3500)||'No plain-text body available. HTML and attachments are not opened.';
 }
 return emails.reverse();
 }finally{lock.release()}
 }
 try{return await Promise.race([read(),timeout])}finally{clearTimeout(timer);client.close()}
}
