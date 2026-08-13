import{c as l}from"./index-DGPcHG4L.js";import{b as s}from"./qr-vendor-fvnKL9Uf.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=l("QrCode",[["rect",{width:"5",height:"5",x:"3",y:"3",rx:"1",key:"1tu5fj"}],["rect",{width:"5",height:"5",x:"16",y:"3",rx:"1",key:"1v8r4q"}],["rect",{width:"5",height:"5",x:"3",y:"16",rx:"1",key:"1x03jg"}],["path",{d:"M21 16h-3a2 2 0 0 0-2 2v3",key:"177gqh"}],["path",{d:"M21 21v.01",key:"ents32"}],["path",{d:"M12 7v3a2 2 0 0 1-2 2H7",key:"8crl2c"}],["path",{d:"M3 12h.01",key:"nlz23k"}],["path",{d:"M12 3h.01",key:"n36tog"}],["path",{d:"M12 16v.01",key:"133mhm"}],["path",{d:"M16 12h1",key:"1slzba"}],["path",{d:"M21 12v.01",key:"1lwtk9"}],["path",{d:"M12 21v-1",key:"1880an"}]]);function g(d){const i=document.createElement("div");return i.textContent=d,i.innerHTML}async function h(d,i=200){try{return await s.toDataURL(d,{width:i,margin:2,errorCorrectionLevel:"M",color:{dark:"#000000",light:"#FFFFFF"}})}catch(e){return console.error("QR generation failed:",e),""}}async function f(d,i){const e=JSON.stringify({batch:d,...i,generated:new Date().toISOString()}),n=await h(e);return{qr1:n,qr2:n}}async function b(d,i,e,n){const t=document.createElement("canvas"),a=t.getContext("2d");if(!a)return;const r=new Image;r.src=d,await new Promise(c=>{r.onload=()=>{t.width=r.width+20*2,t.height=r.height+20*2+30,a.fillStyle="#FFFFFF",a.fillRect(0,0,t.width,t.height),a.drawImage(r,20,20),a.fillStyle="#000000",a.font="bold 13px Arial",a.textAlign="center",a.fillText(e,t.width/2,r.height+20+20),c()}});const o=document.createElement("a");o.download=`${i}.png`,o.href=t.toDataURL("image/png"),document.body.appendChild(o),o.click(),document.body.removeChild(o)}async function p(d,i){const e=document.createElement("canvas"),n=e.getContext("2d"),t=new Image;return t.src=d,await new Promise(a=>{t.onload=()=>{e.width=t.width+20*2,e.height=t.height+20*2+30,n.fillStyle="#FFFFFF",n.fillRect(0,0,e.width,e.height),n.drawImage(t,20,20),n.fillStyle="#000000",n.font="bold 13px Arial",n.textAlign="center",n.fillText(i,e.width/2,t.height+20+20),a()}}),e}async function u(d,i){var t;const e=await p(d,i),n=await new Promise(a=>e.toBlob(a,"image/png"));if(!n)throw new Error("Failed to create QR image");if(typeof ClipboardItem>"u"||!((t=navigator.clipboard)!=null&&t.write))throw new Error("Clipboard image copy is not supported in this browser");await navigator.clipboard.write([new ClipboardItem({"image/png":n})])}function F(d,i,e,n){const t=window.open("","_blank");if(!t)return;const a=g(e);t.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>QR Codes - ${a}</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
        .qr-container { display: inline-block; margin: 20px; padding: 20px; border: 1px solid #ccc; }
        .qr-container canvas { display: block; margin: 0 auto; }
        .qr-container h3 { margin: 10px 0 5px; }
        @media print {
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <h2 class="no-print">Batch: ${a}</h2>
      <div class="qr-container">
        <h3>Copy 1</h3>
        <canvas id="qr1canvas"></canvas>
      </div>
      <div class="qr-container">
        <h3>Copy 2</h3>
        <canvas id="qr2canvas"></canvas>
      </div>
      <br/><br/>
      <button class="no-print" onclick="window.print()">Print QR Codes</button>
      <script>
        function drawQRWithLabel(canvasId, imgSrc, label) {
          var canvas = document.getElementById(canvasId);
          var ctx = canvas.getContext('2d');
          var img = new Image();
          img.onload = function() {
            var padding = 16;
            var textH = 28;
            canvas.width = img.width + padding * 2;
            canvas.height = img.height + padding * 2 + textH;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, padding, padding);
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(label, canvas.width / 2, img.height + padding + 18);
          };
          img.src = imgSrc;
        }
        drawQRWithLabel('qr1canvas', '${d}', '${a}');
        drawQRWithLabel('qr2canvas', '${i}', '${a}');
        setTimeout(function() { window.print(); }, 800);
      <\/script>
    </body>
    </html>
  `),t.document.close()}export{x as Q,h as a,u as c,b as d,f as g,F as p};
