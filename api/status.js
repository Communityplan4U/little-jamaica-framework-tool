'use strict';
const S=require('../server/gateway.cjs');
module.exports=async(req,res)=>{
 if(req.method!=='GET')return S.send(res,405,{error:'Method not allowed'});
 try{
  if(!S.configured())return S.send(res,200,{configured:false,mode:S.mode(),round:3,isOpen:false});
  const d=await S.rpc('ljov_collection_status',{p_source:S.M.id,p_mode:S.mode()});
  return S.send(res,200,{configured:true,mode:S.mode(),round:3,isOpen:d.open===true,closesAt:d.closesAt,minimum:d.minimum});
 }catch{return S.send(res,503,{configured:false,isOpen:false,error:'Survey status temporarily unavailable.'});}
};