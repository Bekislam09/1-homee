// All artwork is drawn locally. World positions stay independent of projection.
const SQRT3_2 = Math.sqrt(3) / 2;
export const iso = (x, y, z = 0) => ({ x: (x - y) * SQRT3_2, y: (x + y) * 0.5 - z });
export const ART_ANCHOR = Object.freeze({ building: 58, dozer: 44, decor: 36 });

const C = {
  ink: '#294b46', grass: '#a4ceb0', grassLight: '#b9dabc', darkGrass: '#7db899',
  road: '#677e7c', curb: '#f4e8cd', line: '#d5d9bd', gold: '#ffcb50',
};

function polygon(ctx, points, fill, stroke = null, width = 1) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function line(ctx, points, color, width = 1) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}
function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
}
function texture(scene, key, width, height, draw) {
  if (scene.textures.exists(key)) return;
  const canvas = scene.textures.createCanvas(key, width, height);
  const ctx = canvas.getContext();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  draw(ctx, width, height);
  canvas.refresh();
}
function localProject(ctx, width, height, anchor) {
  ctx.translate(width / 2, height - anchor);
  return (x, y, z = 0) => iso(x, y, z);
}
function face(ctx, p, coordinates, fill, stroke = null, width = 1) {
  polygon(ctx, coordinates.map(([x, y, z]) => p(x, y, z)), fill, stroke, width);
}
function box(ctx, p, x, y, z, w, d, h, colors) {
  const x2 = x + w; const y2 = y + d; const z2 = z + h;
  face(ctx, p, [[x,y2,z],[x2,y2,z],[x2,y2,z2],[x,y2,z2]], colors[0]);
  face(ctx, p, [[x2,y,z],[x2,y2,z],[x2,y2,z2],[x2,y,z2]], colors[1]);
  face(ctx, p, [[x,y,z2],[x2,y,z2],[x2,y2,z2],[x,y2,z2]], colors[2]);
}
function frontPanel(ctx, p, x, y, z, w, h, fill, edge = null) {
  face(ctx, p, [[x,y,z],[x+w,y,z],[x+w,y,z+h],[x,y,z+h]], fill, edge, 1.3);
}
function sidePanel(ctx, p, x, y, z, w, h, fill, edge = null) {
  face(ctx, p, [[x,y,z],[x,y+w,z],[x,y+w,z+h],[x,y,z+h]], fill, edge, 1.3);
}
function windowFront(ctx, p, x, y, z, w, h, broken = false) {
  frontPanel(ctx,p,x-2,y,z-2,w+4,h+4,'#f5e8cb');
  frontPanel(ctx,p,x,y+0.1,z,w,h,broken ? '#35545c' : '#79b8c4');
  frontPanel(ctx,p,x+2,y+0.2,z+h*.56,w-4,h*.32,broken ? '#54818c' : '#b8e4df');
  line(ctx,[p(x+w/2,y+.3,z),p(x+w/2,y+.3,z+h)],'#f7edda',2);
  line(ctx,[p(x,y+.3,z+h*.48),p(x+w,y+.3,z+h*.48)],'#f7edda',2);
  if (broken) line(ctx,[p(x+2,y+.4,z+1),p(x+w-2,y+.4,z+h-2)],'#d49b6b',3.4);
  frontPanel(ctx,p,x-4,y+2,z-4,w+8,3,'#e4d1aa');
}
function windowSide(ctx, p, x, y, z, w, h, broken = false) {
  sidePanel(ctx,p,x,y-2,z-2,w+4,h+4,'#e3d8bb');
  sidePanel(ctx,p,x+.1,y,z,w,h,broken ? '#35545c' : '#538f9c');
  sidePanel(ctx,p,x+.2,y+2,z+h*.58,w-4,h*.29,broken ? '#527981' : '#8fcad2');
  line(ctx,[p(x+.3,y+w/2,z),p(x+.3,y+w/2,z+h)],'#e3d8bb',2);
  line(ctx,[p(x+.3,y,z+h*.48),p(x+.3,y+w,z+h*.48)],'#e3d8bb',2);
  if (broken) line(ctx,[p(x+.4,y+1,z+h-2),p(x+.4,y+w-1,z+2)],'#a87c5d',3);
}

function roof(ctx, p, w, d, wall, peak, colors) {
  const overhang = 6;
  const x1 = -w/2-overhang; const x2 = w/2+overhang;
  const y1 = -d/2-overhang; const y2 = d/2+overhang;
  // The visible gable, both roof slopes and a pale fascia give a soft toy silhouette.
  face(ctx,p,[[w/2,-d/2,wall],[w/2,d/2,wall],[w/2,0,peak-2]],'#f0d8b5');
  face(ctx,p,[[x1,y1,wall+2],[x2,y1,wall+2],[x2,0,peak],[x1,0,peak]],colors[1]);
  face(ctx,p,[[x1,0,peak],[x2,0,peak],[x2,y2,wall+2],[x1,y2,wall+2]],colors[0]);
  line(ctx,[p(x1,0,peak),p(x2,0,peak)],colors[2],3.5);
  line(ctx,[p(x1,y2,wall),p(x2,y2,wall),p(x2,0,peak),p(x2,y1,wall)],'#f4d9ad',2.5);
  for (let x = x1+15; x < x2; x += 17) {
    line(ctx,[p(x,0,peak-.5),p(x,y2,wall+2)],colors[1],1);
  }
  for (let y = 13; y < y2; y += 14) {
    const z = peak - (peak-wall-2)*y/y2;
    line(ctx,[p(x1,y,z),p(x2,y,z)],colors[2],.8);
  }
}

function cracks(ctx, p, type, stage) {
  if (!stage) return;
  const height = type === 'house' ? 108 : type === 'kiosk' ? 72 : 42;
  const front = [[-33,43,height-9],[-25,43,height-21],[-29,43,height-33],[-17,43,height-39],[-20,43,height-53]];
  line(ctx,front.map(v => p(...v)),'#5e6157',2.1);
  line(ctx,[p(-25,43,height-21),p(-13,43,height-24),p(-7,43,height-18)],'#5e6157',1.5);
  if (stage > 1) {
    line(ctx,[[48,-27,height-6],[48,-20,height-21],[48,-28,height-36],[48,-17,height-46],[48,-24,10]].map(v=>p(...v)),'#465d58',2.6);
    face(ctx,p,[[-44,43,6],[-44,43,23],[-35,43,17],[-32,43,8],[-19,43,6]],'#7d7567');
    frontPanel(ctx,p,21,43.3,32,15,11,'#769684');
    line(ctx,[p(-5,43,height-11),p(2,43,height-22),p(-3,43,height-30),p(8,43,height-41)],'#5e6157',1.6);
  }
}

function drawBuilding(ctx, width, height, type, stage) {
  const p = localProject(ctx,width,height,ART_ANCHOR.building);
  ellipse(ctx,12,13,78,31,'rgba(40,72,56,.14)');
  ellipse(ctx,7,9,64,24,'rgba(40,72,56,.09)');
  box(ctx,p,-53,-48,0,106,96,5,['#dbcbae','#bfba9e','#f6e5c4']);
  if (type === 'shed') {
    box(ctx,p,-48,-43,5,96,86,42,['#d79a75','#b37d62','#f0b48b']);
    // Real boards on both walls, capped corners, a generous double barn door.
    for (let z=13;z<47;z+=10) {
      line(ctx,[p(-48,43.2,z),p(48,43.2,z)],'#b78060',1);
      line(ctx,[p(48.2,-43,z),p(48.2,43,z)],'#9c715b',1);
    }
    frontPanel(ctx,p,-21,43.4,5,43,34,'#946d52');
    frontPanel(ctx,p,-18,43.6,7,37,29,'#bd9b6c');
    line(ctx,[p(.5,44,7),p(.5,44,36)],'#765f4a',1.6);
    line(ctx,[p(-17,44,8),p(18,44,34)],'#ebd0a0',2.6);
    line(ctx,[p(18,44,8),p(-17,44,34)],'#ebd0a0',2.6);
    line(ctx,[p(-46,43.8,5),p(-46,43.8,44)],'#f1c397',4);
    line(ctx,[p(46,43.8,5),p(46,43.8,44)],'#f1c397',4);
    windowSide(ctx,p,48.4,-18,23,23,16,stage>1);
    roof(ctx,p,96,86,47,72,['#638c84','#4f766e','#81a697']);
    // Vent set into the gable.
    sidePanel(ctx,p,48.5,-6,49,12,9,'#806b58');
  } else if (type === 'kiosk') {
    box(ctx,p,-48,-43,5,96,86,72,['#e8977f','#cd786b','#f5b294']);
    box(ctx,p,-50,-45,74,100,90,9,['#eecb9e','#bd9d79','#ffe7ba']);
    box(ctx,p,-42,-37,83,84,74,4,['#db8d75','#b77164','#edaa8a']);
    // Shop glazing, door and tiled lower facade.
    frontPanel(ctx,p,-43,43.2,7,86,21,'#db826e');
    for(let x=-43;x<43;x+=16) line(ctx,[p(x,43.4,7),p(x,43.4,27)],'#efa38c',1.2);
    windowFront(ctx,p,-39,43.5,28,48,28,stage>1);
    frontPanel(ctx,p,20,43.5,7,20,49,'#f8e5c0');
    frontPanel(ctx,p,23,43.7,12,14,38,'#568d98');
    line(ctx,[p(25,44,16),p(25,44,46)],'#98c8cd',1.5);
    const handle = p(34,44,30); ellipse(ctx,handle.x,handle.y,1.2,1.8,'#ffe5a6');
    windowSide(ctx,p,48.3,-26,26,43,31,stage>1);
    // Striped canvas canopy projects over the pavement.
    const strips=8; const aw=-51; const awWidth=102/strips;
    for(let i=0;i<strips;i++) {
      const x=aw+i*awWidth;
      face(ctx,p,[[x,42,64],[x+awWidth,42,64],[x+awWidth,59,55],[x,59,55]],i%2?'#f8e5bd':'#d57264');
      frontPanel(ctx,p,x,59,49,awWidth,6,i%2?'#e9d9b4':'#bb5e58');
    }
    frontPanel(ctx,p,-35,44,68,70,10,'#477b70');
    ctx.save(); const sign=p(0,44.3,70); ctx.transform(SQRT3_2,.5,0,1,sign.x,sign.y);
    ctx.font='bold 8px sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#fff3cc'; ctx.fillText('М А Р К Е Т',0,0); ctx.restore();
    // Small air-conditioning unit on the flat roof.
    box(ctx,p,-32,-26,87,23,20,10,['#bec8bb','#8eaaa1','#e3e6cd']);
    for(let x=-29;x<-12;x+=4) line(ctx,[p(x,-22,97.2),p(x,-10,97.2)],'#95aaa1',1.2);
  } else {
    box(ctx,p,-48,-43,5,96,86,106,['#8fbbac','#6e9f93','#bad8bf']);
    box(ctx,p,-50,-45,54,100,90,5,['#e7dfbb','#bdc4a7','#f5eaca']);
    frontPanel(ctx,p,-48,43.3,5,96,8,'#d8d4b5');
    sidePanel(ctx,p,48.3,-43,5,86,8,'#a8b69a');
    windowFront(ctx,p,-34,43.5,73,22,25,stage>1);
    windowFront(ctx,p,13,43.5,73,22,25,stage>1);
    windowFront(ctx,p,-35,43.5,23,22,22,false);
    windowSide(ctx,p,48.4,-29,74,22,24,stage>1);
    windowSide(ctx,p,48.4,12,74,22,24,false);
    windowSide(ctx,p,48.4,-26,25,25,23,stage>1);
    frontPanel(ctx,p,12,43.6,8,24,36,'#eddcbd');
    frontPanel(ctx,p,16,43.8,9,16,31,'#c88361');
    frontPanel(ctx,p,19,44,26,10,11,'#6a9ca3');
    const knob=p(29,44.3,21); ellipse(ctx,knob.x,knob.y,1.3,1.5,'#ffdf93');
    box(ctx,p,9,44,0,30,14,5,['#c6bea5','#9fa790','#e4dbc0']);
    // Window boxes, shutters and a warm terracotta roof.
    box(ctx,p,-36,44,67,27,6,5,['#b5795d','#8f6e54','#cad28f']);
    for(let x=-32;x<-10;x+=6) {
      const q=p(x,48,73); ellipse(ctx,q.x,q.y,2.8,2,'#d7a766');
    }
    roof(ctx,p,96,86,111,147,['#cc805d','#ad6652','#e8a376']);
    box(ctx,p,-26,-19,128,15,15,24,['#e5bea0','#ba967e','#f2d7b2']);
    box(ctx,p,-28,-21,151,19,19,3,['#cfa985','#a9876b','#efd6b2']);
    sidePanel(ctx,p,48.5,-9,117,18,9,'#46736d');
    line(ctx,[p(48.7,0,117),p(48.7,0,126)],'#d9d7b6',1.7);
  }
  cracks(ctx,p,type,stage);
  if(stage>0) {
    // A few displaced bricks make each damaged stage visibly different.
    box(ctx,p,38,44,0,8,6,5,['#d39a75','#b47c61','#e8b48a']);
    box(ctx,p,-25,50,0,7,5,3,['#c5916b','#a9795b','#e3b58a']);
  }
}

function rotatedPoint(angle, x, y, z) {
  return { x:x*Math.cos(angle)-y*Math.sin(angle), y:x*Math.sin(angle)+y*Math.cos(angle), z };
}
function vehicle(ctx, width, height, angle, treadPhase = 0) {
  ctx.translate(width/2,height-ART_ANCHOR.dozer);
  ellipse(ctx,3,7,55,23,'rgba(38,65,52,.16)');
  ellipse(ctx,0,4,42,17,'rgba(38,65,52,.1)');
  const faces=[];
  const world = (x,y,z) => rotatedPoint(angle,x,y,z);
  const project = v=>iso(v.x,v.y,v.z);
  const addFace=(vertices,fill,normal=null,detail=null)=> {
    if(normal) {
      const n=world(normal[0],normal[1],normal[2]);
      if(n.x+n.y+n.z<=0) return;
    }
    const points=vertices.map(v=>world(...v));
    faces.push({points,fill,detail,depth:points.reduce((sum,p)=>sum+p.x+p.y+p.z,0)/points.length});
  };
  const cube=(x,y,z,w,d,h,colors,details={})=>{
    const X=x+w,Y=y+d,Z=z+h;
    addFace([[x,y,z],[x,Y,z],[x,Y,Z],[x,y,Z]],colors[1],[-1,0,0],details.back);
    addFace([[X,Y,z],[X,y,z],[X,y,Z],[X,Y,Z]],colors[0],[1,0,0],details.front);
    addFace([[X,y,z],[x,y,z],[x,y,Z],[X,y,Z]],colors[1],[0,-1,0],details.left);
    addFace([[x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z]],colors[0],[0,1,0],details.right);
    addFace([[x,y,Z],[x,Y,Z],[X,Y,Z],[X,y,Z]],colors[2],[0,0,1],details.top);
  };
  const drawAtFace=(coordinates,fill)=>({coordinates,fill});
  const wheelDetail=(y)=>({draw:()=>{
    for(let x=-23;x<=23;x+=11.5) {
      const pts=[]; for(let i=0;i<12;i++) {const t=i*Math.PI/6;pts.push(project(world(x+5*Math.cos(t),y,9+5*Math.sin(t))));}
      polygon(ctx,pts,'#607067','#3d5149',1);
      const q=project(world(x,y,9)); ellipse(ctx,q.x,q.y,1.4,1.5,'#9da286');
    }
    for(let x=-24+treadPhase;x<29;x+=8) line(ctx,[project(world(x,y,16)),project(world(Math.min(x+2,29),y,14))],'#a2a38b',1.3);
  }});
  for(const y of [-28,18]) {
    cube(-30,y,3,60,10,14,['#48574e','#354b45','#69746a'],{left:wheelDetail(y-.1),right:wheelDetail(y+10.1)});
  }
  cube(-24,-18,13,49,36,13,['#e6aa32','#c68e29','#ffd769']);
  cube(-27,-17,26,23,34,11,['#eeb63a','#d89b2e','#ffdb70']);
  // Engine cooling slots on the rear deck.
  cube(-25,-13,37,15,26,.7,['#c5912d','#bb892c','#e9ad36'],{top:{draw:()=>{
    for(let x=-22;x<-11;x+=3.5) line(ctx,[project(world(x,-9,38)),project(world(x,9,38))],'#8c772e',1.3);
  }}});
  cube(-9,-15,26,27,30,7,['#f9c951','#d5a13a','#ffe28a']);
  cube(-9,-13,33,22,26,22,['#7ec3cf','#458e9f','#b2e5e6']);
  // Window reflection stripes are actual projected side planes.
  addFace([[-8,-13.2,48],[11,-13.2,48],[11,-13.2,51],[-8,-13.2,51]],'#bfe8e8',[0,-1,0]);
  addFace([[-8,13.2,48],[11,13.2,48],[11,13.2,51],[-8,13.2,51]],'#bfe8e8',[0,1,0]);
  addFace([[13.2,-11,47],[13.2,11,47],[13.2,11,51],[13.2,-11,51]],'#c8eff0',[1,0,0]);
  for(const x of [-11,11])for(const y of [-15,12]) cube(x,y,31,3,3,25,['#f2bb42','#d59d31','#ffda79']);
  cube(-14,-17,55,31,34,5,['#e9ad35','#c99530','#ffdb6d']);
  cube(-23,-12,37,4,4,18,['#53625a','#3b5049','#8a9581']);
  cube(-24,-13,55,6,6,2,['#4f6056','#3b5049','#7c8c77']);
  // Twin hydraulic arms carry the broad, faceted bucket.
  cube(17,-18,12,24,5,5,['#d6992e','#b07c27','#f6c55a']);
  cube(17,13,12,24,5,5,['#d6992e','#b07c27','#f6c55a']);
  const bladeBack=[[37,-32,6],[37,32,6],[46,32,24],[46,-32,24]];
  const bladeFront=[[43,-32,5],[43,32,5],[50,32,25],[50,-32,25]];
  addFace(bladeFront,'#ffd65e',[1,0,0]);
  addFace(bladeBack,'#cc962e',[-1,0,0]);
  addFace([[37,32,6],[43,32,5],[50,32,25],[46,32,24]],'#c28b2b',[0,1,0]);
  addFace([[43,-32,5],[37,-32,6],[46,-32,24],[50,-32,25]],'#e8b13d',[0,-1,0]);
  addFace([[46,-32,24],[46,32,24],[50,32,25],[50,-32,25]],'#ffe58c',[0,0,1]);
  cube(42,-33,3,4,66,4,['#a7aaa0','#808e82','#d5d4bb']);
  for(const y of [-14,10]) cube(21,y,24,3,4,5,['#fff6ca','#e7d593','#fffde4']);
  // Painted tow marking at the rear.
  cube(-28,-8,23,1,16,3,['#a87c2c','#966e26','#f1bb4a']);
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces) {
    polygon(ctx,f.points.map(project),f.fill);
    if(f.detail?.draw) f.detail.draw();
  }
}

function rubble(ctx,w,h) {
  const p=localProject(ctx,w,h,ART_ANCHOR.building);
  ellipse(ctx,5,8,65,26,'rgba(70,77,56,.12)');
  face(ctx,p,[[-45,-36,0],[44,-36,0],[47,35,0],[-40,39,0]],'#b1af91');
  const bricks=[[-30,-24,20,12,6],[-9,-29,21,14,9],[17,-18,17,12,7],[-39,0,16,12,10],[-13,-2,24,16,14],[17,6,20,13,9],[-22,22,17,12,6],[4,28,19,9,6],[29,27,15,11,4]];
  for(const [x,y,bw,bd,bh] of bricks) box(ctx,p,x,y,1,bw,bd,bh,['#d7ab86','#b58d70','#edc79e']);
  face(ctx,p,[[-7,-16,13],[24,-8,14],[18,16,19],[-11,9,16]],'#bd815f');
  line(ctx,[p(-21,24,9),p(17,-8,23)],'#ded1ab',5);
}

function tree(ctx,w,h,variant=0) {
  const p=localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,3,5,30,13,'rgba(48,90,63,.13)');
  box(ctx,p,-4,-4,0,8,8,48,['#b58a63','#8f7355','#cda47a']);
  const crowns=variant ? [[0,-48,22,29],[-14,-57,21,27],[14,-58,23,28],[1,-77,24,26]] : [[0,-44,28,24],[-15,-62,24,23],[15,-67,25,25],[0,-85,23,23]];
  for(const [x,y,rx,ry] of crowns) {
    ellipse(ctx,x+3,y+4,rx,ry,'#639c76');
    ellipse(ctx,x-2,y-2,rx-1,ry-2,variant?'#8cbc86':'#83b886');
    ellipse(ctx,x-7,y-8,rx*.5,ry*.39,variant?'#a8ce94':'#a4cc94');
  }
  const q=p(0,0,30); line(ctx,[q,{x:q.x+9,y:q.y-14}],'#a7835c',4);
}
function shrub(ctx,w,h) {
  localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,0,3,23,9,'rgba(48,90,63,.12)');
  for(const [x,y,r] of [[-13,-7,13],[2,-13,16],[15,-8,12]]) {
    ellipse(ctx,x+2,y+3,r,r*.67,'#599375');
    ellipse(ctx,x,y,r,r*.67,'#87b98a');
    ellipse(ctx,x-3,y-3,r*.53,r*.32,'#a8cd95');
  }
}
function lamp(ctx,w,h) {
  const p=localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,7,5,14,5,'rgba(47,73,58,.12)');
  box(ctx,p,-5,-5,0,10,10,4,['#798d7c','#5f786d','#9aad95']);
  line(ctx,[p(0,0,3),p(0,0,79),p(0,-9,84)],'#647b70',4);
  const q=p(0,-11,82);
  ellipse(ctx,q.x,q.y,9,4,'#49685e');
  ellipse(ctx,q.x,q.y+2,7,3,'#f6e7b5');
  line(ctx,[p(0,0,71),p(0,-9,78)],'#647b70',1.6);
}
function cone(ctx,w,h) {
  const p=localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,0,3,10,4,'rgba(47,73,58,.1)');
  box(ctx,p,-7,-7,0,14,14,2,['#e6a475','#c2835f','#ffbd8b']);
  face(ctx,p,[[-5,-5,2],[5,-5,2],[1,1,21]],'#e49b5e');
  face(ctx,p,[[-5,5,2],[5,5,2],[1,1,21]],'#f6a76c');
  face(ctx,p,[[5,-5,2],[5,5,2],[1,1,21]],'#ce7f50');
  face(ctx,p,[[-2.5,3.8,10],[3.8,3.8,10],[2.6,2.6,14],[-.8,2.6,14]],'#fff0cf');
}
function fence(ctx,w,h) {
  const p=localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,2,4,34,10,'rgba(47,73,58,.08)');
  for(const x of [-30,-15,0,15,30]) box(ctx,p,x,-2,0,4,4,27,['#e9d7b6','#c5b997','#fae8c7']);
  box(ctx,p,-32,-1,8,67,3,4,['#e9d7b6','#c5b997','#fff0d2']);
  box(ctx,p,-32,-1,21,67,3,4,['#e9d7b6','#c5b997','#fff0d2']);
}
function bench(ctx,w,h) {
  const p=localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,3,5,33,12,'rgba(47,73,58,.1)');
  for(const x of [-23,19]) box(ctx,p,x,-5,0,4,15,13,['#648777','#466b5f','#8ba38a']);
  for(const y of [-7,-1,5]) box(ctx,p,-29,y,13,58,5,3,['#cfa774','#ac895e','#e8c38b']);
  box(ctx,p,-27,-8,16,3,3,21,['#648777','#466b5f','#8ba38a']);
  box(ctx,p,24,-8,16,3,3,21,['#648777','#466b5f','#8ba38a']);
  box(ctx,p,-29,-9,23,58,4,7,['#cfa774','#ac895e','#e8c38b']);
  box(ctx,p,-29,-9,32,58,4,5,['#cfa774','#ac895e','#e8c38b']);
}
function car(ctx,w,h,color) {
  const p=localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,0,5,37,13,'rgba(47,73,58,.14)');
  for(const x of [-24,16])for(const y of [-17,11]) box(ctx,p,x,y,1,9,6,11,['#40554e','#324a43','#62746a']);
  box(ctx,p,-32,-15,7,65,30,12,[color,'#ad786b','#edbba0']);
  box(ctx,p,-15,-13,19,31,26,16,['#83bdc5','#5c959e','#c1e1dc']);
  box(ctx,p,-18,-15,35,35,30,3,[color,'#ad786b','#edbba0']);
  for(const y of [-13,8])box(ctx,p,32,y,13,1,5,4,['#fff0c1','#e6d497','#ffefb4']);
  line(ctx,[p(-29,15.3,10),p(29,15.3,10)],'#f2d4bb',1.3);
}

export function createTextures(scene) {
  for(const type of ['shed','kiosk','house'])for(let stage=0;stage<3;stage++) {
    texture(scene,`${type}-${stage}`,256,292,(ctx,w,h)=>drawBuilding(ctx,w,h,type,stage));
  }
  texture(scene,'rubble',256,292,rubble);
  for(let i=0;i<8;i++) {
    texture(scene,`dozer-${i}`,180,160,(ctx,w,h)=>vehicle(ctx,w,h,i*Math.PI/4));
    texture(scene,`dozer-${i}-moving`,180,160,(ctx,w,h)=>vehicle(ctx,w,h,i*Math.PI/4,4));
  }
  texture(scene,'dust',48,48,(ctx)=>{
    const g=ctx.createRadialGradient(24,24,2,24,24,22);g.addColorStop(0,'rgba(248,231,190,.8)');g.addColorStop(.45,'rgba(234,218,181,.45)');g.addColorStop(1,'rgba(234,218,181,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,48,48);
  });
  texture(scene,'chip',20,20,(ctx)=>{
    polygon(ctx,[{x:3,y:6},{x:11,y:2},{x:18,y:7},{x:17,y:14},{x:9,y:18},{x:3,y:13}],'#bf8c68');
    polygon(ctx,[{x:3,y:6},{x:11,y:2},{x:18,y:7},{x:10,y:11}],'#f0c29a');
    polygon(ctx,[{x:10,y:11},{x:18,y:7},{x:17,y:14},{x:9,y:18}],'#d9a579');
  });
  texture(scene,'coin',32,36,(ctx)=>{
    ellipse(ctx,16,20,12,13,'#c98f31');ellipse(ctx,16,16,12,13,'#ffe17a');ellipse(ctx,16,16,9,10,'#f5b63d');
    ctx.strokeStyle='#ffdf71';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(16,16,8,9,0,0,Math.PI*2);ctx.stroke();
    line(ctx,[{x:17,y:10},{x:13,y:14},{x:19,y:18},{x:15,y:22}],'#fff0a7',2.5);
    ellipse(ctx,12,9,3,2,'#fff4bd');
  });
  texture(scene,'spark',32,32,(ctx)=>polygon(ctx,[{x:16,y:1},{x:20,y:12},{x:31,y:16},{x:20,y:20},{x:16,y:31},{x:12,y:20},{x:1,y:16},{x:12,y:12}],'#fff0ad'));
  texture(scene,'tree-a',160,180,(ctx,w,h)=>tree(ctx,w,h,0));
  texture(scene,'tree-b',160,180,(ctx,w,h)=>tree(ctx,w,h,1));
  texture(scene,'shrub',100,90,shrub);
  texture(scene,'lamp',100,150,lamp);
  texture(scene,'cone',64,76,cone);
  texture(scene,'fence',130,105,fence);
  texture(scene,'bench',140,115,bench);
  texture(scene,'car-coral',160,140,(ctx,w,h)=>car(ctx,w,h,'#d99581'));
  texture(scene,'car-blue',160,140,(ctx,w,h)=>car(ctx,w,h,'#8cbbb4'));
}

function worldPolygon(ctx,coordinates,fill,stroke=null,width=1) {
  polygon(ctx,coordinates.map(([x,y,z=0])=>iso(x,y,z)),fill,stroke,width);
}
function worldLine(ctx,coordinates,color,width=1) {
  line(ctx,coordinates.map(([x,y,z=0])=>iso(x,y,z)),color,width);
}
function worldRect(ctx,x,y,w,d,fill) {
  worldPolygon(ctx,[[x,y],[x+w,y],[x+w,y+d],[x,y+d]],fill);
}

export function drawGround(scene) {
  texture(scene,'smash-ground',1900,1190,(ctx)=>{
    ctx.translate(950,62);
    // A little floating diorama; its exposed edge remains visible at camera limits.
    const corners=[[0,0],[1000,0],[1000,1000],[0,1000]];
    ctx.save();ctx.shadowColor='rgba(54,96,79,.20)';ctx.shadowBlur=26;ctx.shadowOffsetY=29;
    worldPolygon(ctx,corners,'#89b895');ctx.restore();
    worldPolygon(ctx,[[0,1000,0],[1000,1000,0],[1000,1000,-25],[0,1000,-25]],'#84b393');
    worldPolygon(ctx,[[1000,0,0],[1000,1000,0],[1000,1000,-25],[1000,0,-25]],'#6fa487');
    worldPolygon(ctx,corners,C.grass);
    // Pale perimeter margin and discrete painted paving around every block.
    worldRect(ctx,14,14,972,972,'#b3d4b4');
    const centers=[180,400,620,840];
    centers.forEach((x,ix)=>centers.forEach((y,iy)=>{
      const park=(ix===3&&iy===0)||(ix===0&&iy===3);
      worldRect(ctx,x-73,y-73,146,146,'#e3d9b9');
      worldRect(ctx,x-64,y-64,128,128,park?'#aed0a1':'#eae0c2');
      if(park) {
        worldRect(ctx,x-57,y-57,114,114,'#a6c99b');
        worldRect(ctx,x-6,y-63,12,126,'#e3d9b9');
        worldRect(ctx,x-63,y-6,126,12,'#e3d9b9');
      } else {
        worldRect(ctx,x-54,y-49,108,98,'#d2c8a7');
        worldRect(ctx,x-59,y+51,118,8,'#f3e9cc');
        for(let u=-65;u<70;u+=20) {
          worldLine(ctx,[[x+u,y+61],[x+u,y+71]],'#cfc6a6',.7);
          worldLine(ctx,[[x+61,y+u],[x+71,y+u]],'#cfc6a6',.7);
        }
      }
    }));
    const roads=[65,290,510,730,950];
    for(const r of roads) {
      worldRect(ctx,r-51,10,102,980,'#d4cfb0');
      worldRect(ctx,10,r-51,980,102,'#d4cfb0');
    }
    for(const r of roads) {
      worldRect(ctx,r-44,12,88,976,C.road);
      worldRect(ctx,12,r-44,976,88,C.road);
    }
    // Muted lane dashes skip junctions. Small offset strips imply asphalt grain.
    const inJunction=v=>roads.some(r=>Math.abs(v-r)<58);
    for(const r of roads)for(let s=14;s<980;s+=37) {
      if(inJunction(s))continue;
      worldRect(ctx,r-1,s,2,17,C.line);
      worldRect(ctx,s,r-1,17,2,C.line);
    }
    for(const r of roads)for(const cross of roads) {
      if(cross===65||cross===950)continue;
      for(let stripe=-31;stripe<34;stripe+=11) {
        worldRect(ctx,r+stripe,cross-65,6,11,'#e6e4c9');
        worldRect(ctx,cross-65,r+stripe,11,6,'#e6e4c9');
      }
    }
    // Fine curb joints and warm paving make this a toy town rather than a grid.
    for(const r of roads)for(let s=120;s<920;s+=26)if(!inJunction(s)) {
      worldLine(ctx,[[r-51,s],[r-45,s]],'#b6bea4',1);
      worldLine(ctx,[[r+45,s],[r+51,s]],'#b6bea4',1);
      worldLine(ctx,[[s,r-51],[s,r-45]],'#b6bea4',1);
      worldLine(ctx,[[s,r+45],[s,r+51]],'#b6bea4',1);
    }
    // The construction corner has an honest little sand pad.
    worldRect(ctx,801,139,79,37,'#d9c18e');
    worldRect(ctx,803,141,75,33,'#e9d5a6');
    for(let i=0;i<25;i++) {
      const x=810+(i*19)%64,y=145+(i*13)%23;const p=iso(x,y);
      ellipse(ctx,p.x,p.y,1.3,.7,'#cdb789');
    }
    // Low planting at the island edge, deliberately outside the navigable roads.
    for(let i=0;i<33;i++) {
      const s=15+i*30;const p=iso(5,s);ellipse(ctx,p.x,p.y,3.2,1.3,'#90bc98');
      const q=iso(s,995);ellipse(ctx,q.x,q.y,3.2,1.3,'#78ad88');
    }
    worldLine(ctx,[[0,1000],[1000,1000],[1000,0]],'#bcdbb6',2);
  });
  return scene.add.image(-950,-62,'smash-ground').setOrigin(0,0).setDepth(-10000);
}

export function createDecor(scene) {
  const result=[];
  const add=(key,x,y,scale=1)=>{
    const p=iso(x,y);const view=scene.add.image(p.x,p.y+ART_ANCHOR.decor*scale,key).setOrigin(.5,1).setScale(scale).setDepth(x+y);
    result.push({view,x,y});return view;
  };
  // Block corners leave both the roads and the destructible footprints clear.
  const centers=[180,400,620,840];
  centers.forEach((x,ix)=>centers.forEach((y,iy)=>{
    const park=(ix===3&&iy===0)||(ix===0&&iy===3);
    if(park)return;
    if((ix+iy)%2===0)add('tree-a',x-61,y-59,.8);
    else add('shrub',x-60,y-58,.9);
    add('shrub',x+60,y-56,.85);
    if((ix+iy)%3===0)add('lamp',x+64,y+63,.88);
    if((ix+iy)%3===1)add('fence',x-15,y+65,.65);
  }));
  // A small garden in the southern corner.
  add('tree-b',142,810,1.05);add('tree-a',214,807,.92);
  add('tree-a',141,879,.9);add('tree-b',221,880,1.04);
  add('bench',169,856,.82);add('lamp',204,850,.84);
  add('shrub',173,809,1);add('shrub',222,848,.9);
  // The opposite park is now a tidy construction yard.
  add('tree-b',793,220,.85);add('tree-a',892,224,.94);
  add('fence',844,239,.9);add('fence',815,121,.75);
  for(const [x,y] of [[797,146],[884,143],[884,178],[799,179]])add('cone',x,y,.9);
  add('shrub',889,197,.8);
  // Parked cars tuck against pavements without narrowing the central lanes.
  add('car-coral',111,404,.68);add('car-blue',771,623,.68);
  add('cone',243,137,.7);add('cone',239,229,.7);
  add('bench',608,684,.64);
  return result;
}
