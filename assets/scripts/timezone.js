export const localTimezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
export const localOffsetMinutes=-(new Date().getTimezoneOffset());
export function offsetMinutesForZone(iana){
  const now=Date.now();
  const utcStr=new Date(now).toLocaleString('en-US',{timeZone:'UTC',hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const tzStr=new Date(now).toLocaleString('en-US',{timeZone:iana,hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  return (parseLocaleDate(tzStr)-parseLocaleDate(utcStr))/60000;
}
function parseLocaleDate(s){
  const[date,time]=s.split(', ');
  const[m,d,y]=date.split('/');
  return new Date(`${y}-${m}-${d}T${time === '24:00:00' ? '00:00:00' : time}Z`).getTime();
}
export function shiftTimestamp(unixSec,targetOffsetMinutes){
  return unixSec+targetOffsetMinutes*60;
}
export function formatTimestampInZone(unixSec,iana){
  return new Date(unixSec*1000).toLocaleString('sv-SE',{timeZone:iana}).replace(' ','T');
}
export function isoInZone(unixSec,iana){
  const d=new Date(unixSec*1000);
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:iana,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
  }).formatToParts(d);
  const get=t=>parts.find(p=>p.type===t)?.value;
  let h=get('hour');
  if(h==='24') h='00';
  return `${get('year')}-${get('month')}-${get('day')}T${h}:${get('minute')}:${get('second')}`;
}