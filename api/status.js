'use strict';
const S=require('../server/survey.cjs');
module.exports=async(req,res)=>S.send(res,req.method==='GET'?200:405,req.method==='GET'?{configured:S.configured(),mode:S.mode(),round:2}:{error:'Method not allowed'});
