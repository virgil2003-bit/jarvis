// Explicit read requests only. No email text or previous model output is inspected.
export function isMailReview(text){
 const value=String(text).toLowerCase().replace(/[’]/g,"'");
 if(/\b(don't|do not|never|stop|without)\b|\bhow (do|can|would|should)\b/.test(value))return false;
 const mail='(?:e[ -]?mails?|mails?|inbox)';
 if(/\b(e[ -]?mail|inbox|mail)\s+briefing\b/.test(value)||/\bbriefing\b.{0,35}\b(e[ -]?mails?|inbox|mail)\b/.test(value))return true;
 return new RegExp('\\b(?:check|read|review|summari[sz]e|show|fetch|open|look at|go through)\\b.{0,60}\\b'+mail+'\\b').test(value)
 ||new RegExp("\\b(?:what(?:'s| is)|anything|any)\\b.{0,30}\\b(?:in my|new|unread)\\b.{0,20}\\b"+mail+'\\b').test(value);
}
