'use strict';
const S=require('../server/gateway.cjs');
module.exports=async(req,res)=>{
 if(req.method!=='GET')return S.send(res,405,{error:'Method not allowed'});
 try{
  const d=await S.rpc('ljov_community_average',{p_source:S.M.id,p_mode:S.mode()});
  if(d.available!==true)return S.send(res,200,{...d,collectionMode:S.mode()});
  const tw=d.topicWeights||{},themeWeights={},outcomeWeights={};
  for(const t of S.WB.topics){
   const n=Number(tw[t.code]);if(!Number.isFinite(n))continue;
   themeWeights[t.theme]=(themeWeights[t.theme]||0)+n;
   for(const [outcome,active] of Object.entries(t.outcomeFlags||{})){
    if(active===1)outcomeWeights[outcome]=(outcomeWeights[outcome]||0)+n;
   }
  }
  S.send(res,200,{...d,themeWeights,outcomeWeights,collectionMode:S.mode()});
 }catch(e){S.send(res,503,{error:'Community averages are unavailable. No individual responses are shown.'});}
};