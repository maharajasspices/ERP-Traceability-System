const fs=require("fs");
const src=fs.readFileSync("src/pages/PickleProduction.tsx","utf8");
const stack=[];let line=1;let i=0;
function lineOf(pos){return src.slice(0,pos).split("\n").length;}
const pairs={")":"(","]":"[","}":"{"};
const openers="([{";
const closers=")]}";
let state="code";const tmplDepth=[];
while(i<src.length){
 const c=src[i];const n=src[i+1];
 if(c==="\n"){line++;i++;continue;}
 if(state==="code"){
   if(c==="/"&&n==="/"){state="line";i+=2;continue;}
   if(c==="/"&&n==="*"){state="block";i+=2;continue;}
   if(c==="\""){state="sq";i++;continue;}
   if(c==="'" ){state="dq";i++;continue;}
   if(c==="`"){state="tmpl";i++;continue;}
   if(openers.includes(c)){stack.push({c,pos:i,line});i++;continue;}
   if(closers.includes(c)){const top=stack.pop();if(!top||top.c!==pairs[c]){console.log("MISMATCH",c,"at line",line,"expected close of",top&&top.c,"opened at line",top&&top.line);process.exit(0);}i++;continue;}
   i++;continue;
 }
 if(state==="line"){if(c==="\n")state="code";i++;continue;}
 if(state==="block"){if(c==="*"&&n==="/"){state="code";i+=2;continue;}i++;continue;}
 if(state==="sq"){if(c==="\\"){i+=2;continue;}if(c==="\"")state="code";i++;continue;}
 if(state==="dq"){if(c==="\\"){i+=2;continue;}if(c==="'")state="code";i++;continue;}
 if(state==="tmpl"){if(c==="\\"){i+=2;continue;}if(c==="`"){state="code";i++;continue;}i++;continue;}
}
console.log("end state",state);
console.log("unclosed stack (top 10):");
stack.slice(-10).forEach(s=>console.log(" ",s.c,"line",s.line));
