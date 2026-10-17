// Real input-only route through a four-row district. No mutations of game state.
export function driveDistrict(sim,{noCombo=false,tick=input=>sim.update(1/60,input)}={}){
  const move=(x,y)=>{
    for(let n=0;n<1200&&sim.phase==='playing';n++){
      const dx=x-sim.player.x,dy=y-sim.player.y,d=Math.hypot(dx,dy);
      if(d<3&&sim.player.speed<5)return;
      const m=Math.min(1,d/40);tick({x:dx/(d||1)*m,y:dy/(d||1)*m});
    }
    if(sim.phase==='playing')throw Error(`Blocked waypoint ${x},${y}`);
  };
  const attack=b=>{
    if(b.hp<=0||sim.phase!=='playing')return;
    for(let n=0;n<2400&&b.hp>0&&sim.phase==='playing';n++){
      const dx=b.x-sim.player.x,dy=b.y-sim.player.y,d=Math.hypot(dx,dy);
      const alignment=(dx*Math.cos(sim.player.heading)+dy*Math.sin(sim.player.heading))/(d||1);
      tick({x:dx/(d||1),y:dy/(d||1),ram:alignment>.98&&d<Math.max(100,sim.vehicle.reach+45)&&sim.player.ramCooldown<1e-7});
    }
    if(b.hp>0&&sim.phase!=='won')throw Error(`Unfinished ${b.id} at ${sim.elapsed.toFixed(1)}s`);
    for(let n=0;n<(noCombo?7.2:0)*60&&sim.phase==='playing';n++)tick({});
  };
  for(let block=0;block<(sim.freeMode?1:sim.mission.sectors)&&sim.phase==='playing';block++){
    const rows=[...new Set(sim.buildings.map(b=>b.y))].sort((a,b)=>a-b);
    for(let r=0;r<rows.length&&sim.phase==='playing'&&sim.sector===block;r++){
      const y=rows[r],reverse=r%2===1,edge=reverse?950:65;
      if(r){move(edge,rows[r-1]);move(edge,y);}
      const row=sim.buildings.filter(b=>b.y===y).sort((a,b)=>reverse?b.x-a.x:a.x-b.x);
      for(const b of row)attack(b);
    }
    for(let n=0;n<75&&sim.phase==='playing'&&sim.sector===block&&!sim.freeMode;n++)tick({});
  }
  return sim.result();
}
