import { router, json, error, db, requireAuth } from '@appdeploy/sdk';

const TABLES=['rawStock','readyShoes','production','articles','purchases','sales','invoices','customers','suppliers','payments','expenses','recycle'];
const num=(v:any)=>Number(v||0);
const same=(a:any,b:any)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
const cartonPairs:Record<string,number>={'12 pairs':12,'18 pairs':18,'24 pairs':24};
const bagPairs:Record<string,number>={'100 pairs/bag':100,'150 pairs/bag':150};

async function authorizeWorkspace(ctx:any){
  const user=ctx.user!;
  const workspaceId=String(user.userId||'');
  if(!workspaceId)return error('Authenticated Google account is missing a workspace ID.',403);
  const {items:profiles}=await db.list('appUsers',{limit:200});
  const existing=profiles.find((r:any)=>String(r.userId)===workspaceId);
  if(!existing){
    const [id]=await db.add('appUsers',[{
      userId:workspaceId,
      workspaceId,
      email:user.email||'',
      name:user.name||'',
      role:'Admin',
      createdAt:new Date().toISOString()
    }]);
    if(!id)return error('Could not initialize your ERP workspace.',500);
  }
  const {items:owners}=await db.list('appOwner',{limit:1});
  if(!owners.length){
    const [id]=await db.add('appOwner',[{
      userId:workspaceId,
      email:user.email||'',
      name:user.name||'',
      role:'Admin',
      createdAt:new Date().toISOString()
    }]);
    if(!id)return error('Could not initialize the ERP owner account.',500);
  }
  return null;
}
const ownerOnly=()=>async(ctx:any)=>authorizeWorkspace(ctx);

async function isLegacyOwner(workspaceId:string){
  const {items}=await db.list('appOwner',{limit:1});
  return !!items.length&&String(items[0].userId)===String(workspaceId);
}
async function listOwned(table:string,workspaceId:string){
  const legacyOwner=await isLegacyOwner(workspaceId);
  if(legacyOwner){
    const {items}=await db.list(table,{limit:200});
    return items.filter((r:any)=>!r.workspaceId||String(r.workspaceId)===workspaceId);
  }
  const {items}=await db.list(table,{filter:{workspaceId},limit:200});
  return items;
}
async function getOwned(table:string,id:string,workspaceId:string){
  const [record]=await db.get(table,[id]);
  if(!record)return null;
  const legacyOwner=await isLegacyOwner(workspaceId);
  const recordWorkspace=String((record as any).workspaceId||'');
  if(recordWorkspace===workspaceId||(legacyOwner&&!recordWorkspace))return record;
  return null;
}

async function findByName(table:string,name:string,workspaceId:string){
  const items=await listOwned(table,workspaceId);
  return items.find((r:any)=>same(r.name,name));
}
async function ensureAccount(table:string,name:string,workspaceId:string){
  if(!name)return null;
  const existing=await findByName(table,name,workspaceId);
  if(existing)return existing.id;
  const [id]=await db.add(table,[{name:String(name).trim(),credit:0,debit:0,workspaceId,createdAt:new Date().toISOString()}]);
  return id;
}
async function adjustUpper(article:string,delta:number,workspaceId:string){
  let remaining=Math.abs(delta);
  const items=await listOwned('rawStock',workspaceId);
  const rows=items.filter((r:any)=>r.category==='Uppers'&&same(r.article,article));
  const available=rows.reduce((s:number,r:any)=>s+num(r.availablePairs??r.totalPairs),0);
  if(delta>0&&available<delta)throw new Error('Insufficient Upper stock for '+article+'. Available pairs: '+available);
  if(delta>0){
    for(const r of rows){
      if(remaining<=0)break;
      const cur=num(r.availablePairs??r.totalPairs),take=Math.min(cur,remaining);
      if(take){const ok=await db.update('rawStock',[{id:r.id,record:{...r,availablePairs:cur-take}}]);if(!ok?.length)throw new Error('Could not update Upper stock.');remaining-=take;}
    }
  }else{
    const target=rows[0];
    if(!target)throw new Error('Upper article not found: '+article);
    const cur=num(target.availablePairs??target.totalPairs);
    const ok=await db.update('rawStock',[{id:target.id,record:{...target,availablePairs:cur+remaining}}]);
    if(!ok?.length)throw new Error('Could not restore Upper stock.');
  }
}
async function getReadyRows(article:string,workspaceId:string){
  const items=await listOwned('readyShoes',workspaceId);
  return items.filter((r:any)=>same(r.article,article));
}
async function consumeReady(article:string,pairs:number,workspaceId:string){
  let remaining=pairs;
  const rows=await getReadyRows(article,workspaceId);
  const available=rows.reduce((s:number,r:any)=>s+num(r.availablePairs??r.totalPairs),0);
  if(available<pairs)throw new Error('Insufficient Ready Shoes for '+article+'. Available: '+available+' pairs.');
  const consumed:any[]=[];
  for(const r of rows){
    if(remaining<=0)break;
    const cur=num(r.availablePairs??r.totalPairs),take=Math.min(cur,remaining);
    if(take){
      const next={...r,availablePairs:cur-take};
      const ok=await db.update('readyShoes',[{id:r.id,record:next}]);
      if(!ok?.length)throw new Error('Could not deduct Ready Shoes stock.');
      consumed.push({id:r.id,pairs:take,cartonType:r.cartonType});
      remaining-=take;
    }
  }
  return consumed;
}
async function restoreReady(article:string,pairs:number,source?:any[],workspaceId:string){
  let remaining=pairs;
  if(Array.isArray(source)&&source.length){
    for(const s of source){
      const row=await getOwned('readyShoes',s.id,workspaceId);
      if(row){
        const next={...row,availablePairs:num(row.availablePairs??row.totalPairs)+num(s.pairs)};
        const ok=await db.update('readyShoes',[{id:s.id,record:next}]);
        if(!ok?.length)throw new Error('Could not restore Ready Shoes stock.');
        remaining-=num(s.pairs);
      }
    }
  }
  if(remaining>0){
    const rows=await getReadyRows(article,workspaceId);
    const target=rows[0];
    if(target){
      const next={...target,availablePairs:num(target.availablePairs??target.totalPairs)+remaining,totalPairs:Math.max(num(target.totalPairs),num(target.availablePairs??0)+remaining)};
      const ok=await db.update('readyShoes',[{id:target.id,record:next}]);
      if(!ok?.length)throw new Error('Could not restore Ready Shoes stock.');
    }else{
      const cartonType='24 pairs',cartons=Math.floor(remaining/cartonPairs[cartonType]);
      if(cartons>0)await db.add('readyShoes',[{name:article,article,cartonType,cartons,totalPairs:cartons*24,availablePairs:cartons*24,workspaceId,date:new Date().toISOString().slice(0,10),createdAt:new Date().toISOString(),restoredFromInvoice:true}]);
    }
  }
}
async function createProduction(record:any,workspaceId:string){
  const output=num(record.outputPairs)||(num(record.cartons)*(cartonPairs[record.cartonType]||0));
  if(!record.article||output<=0)throw new Error('Production article and quantity are required.');
  await adjustUpper(record.article,output,workspaceId);
  const ready={name:record.article,article:record.article,cartonType:record.cartonType,cartons:num(record.cartons),totalPairs:output,availablePairs:output,workspaceId,productionId:'pending',productionSource:true,date:record.date||new Date().toISOString().slice(0,10),createdAt:new Date().toISOString()};
  const [readyId]=await db.add('readyShoes',[ready]);
  if(!readyId){await adjustUpper(record.article,-output);throw new Error('Could not create Ready Shoes stock.');}
  const prod={...record,workspaceId,outputPairs:output,consumedPairs:output,readyId};
  const [id]=await db.add('production',[prod]);
  if(!id){
    await db.delete('readyShoes',[readyId]);
    await adjustUpper(record.article,-output,workspaceId);
    throw new Error('Could not save production.');
  }
  const [readyRecord]=await db.get('readyShoes',[readyId]);
  if(readyRecord)await db.update('readyShoes',[{id:readyId,record:{...readyRecord,productionId:id}}]);
  return {id};
}
async function deleteRecord(table:string,id:string,workspaceId:string){
  const record=await getOwned(table,id,workspaceId);
  if(!record)return false;
  const r:any=record;
  if(table==='production'){
    if(r.readyId)await db.delete('readyShoes',[r.readyId]);
    const consumed=num(r.consumedPairs)||(Array.isArray(r.consumedFrom)?r.consumedFrom.reduce((s:number,x:any)=>s+num(x.pairs),0):num(r.outputPairs));
    if(consumed>0)await adjustUpper(r.article,-consumed,workspaceId);
  }
  if(table==='invoices'){
    await restoreReady(r.article,num(r.pairs),r.readyConsumedFrom,workspaceId);
    if(r.salesId)await db.delete('sales',[r.salesId]);
  }
  if(table==='purchases'&&r.rawStockId)await db.delete('rawStock',[r.rawStockId]);
  if(table==='sales'&&!r.invoiceId){
    // Sales created outside invoices are removed without affecting stock because legacy records had no stock ledger.
  }
  const [rid]=await db.add('recycle',[{originalTable:table,originalId:id,record:r,workspaceId,deletedAt:new Date().toISOString()}]);
  if(!rid)throw new Error('Recycle Bin write failed. Record was not deleted.');
  const deleted=await db.delete(table,[id]);
  if(!deleted?.length){
    await db.delete('recycle',[rid]);
    throw new Error('Database delete did not confirm removal.');
  }
  return true;
}
export const handler=router({
  'GET /api/_healthcheck':[async()=>json({message:'Success'})],
  'GET /api/state':[requireAuth(),ownerOnly(),async({user})=>{
    const workspaceId=String(user!.userId);
    const records:Record<string,any[]>={};
    for(const table of TABLES)records[table]=await listOwned(table,workspaceId);
    return json({records});
  }],
  'POST /api/records':[requireAuth(),ownerOnly(),async({body,user})=>{
    const workspaceId=String(user!.userId);
    const input=body as {table?:string;record?:Record<string,any>};
    if(!input.table||!TABLES.includes(input.table)||input.table==='recycle'||!input.record)return error('Invalid record',400);
    if(input.table==='production'){try{return json(await createProduction({...input.record,workspaceId},workspaceId));}catch(e){return error(e instanceof Error?e.message:'Production failed',400);}}
    const record:any={...input.record,workspaceId,createdAt:input.record.createdAt||new Date().toISOString()};
    if(input.table==='invoices'){
      record.invoiceNumber=record.invoiceNumber||('INV-'+Date.now());
      if(!record.customer||!record.article||num(record.pairs)<=0)return error('Customer, article and quantity are required.',400);
      const customerId=await ensureAccount('customers',record.customer,workspaceId);
      let consumed:any[]=[];
      try{consumed=await consumeReady(record.article,num(record.pairs),workspaceId);}
      catch(e){return error(e instanceof Error?e.message:'Ready Shoes stock unavailable',400);}
      record.entryType='Banam';
      record.readyConsumedFrom=consumed;
      const [id]=await db.add('invoices',[record]);
      if(!id){await restoreReady(record.article,num(record.pairs),consumed,workspaceId);return error('Could not save invoice',500);}
      const [salesId]=await db.add('sales',[{customer:record.customer,article:record.article,cartons:record.cartons,pairs:record.pairs,total:record.total,date:record.date,invoiceNumber:record.invoiceNumber,invoiceId:id,workspaceId,createdAt:new Date().toISOString()}]);
      if(salesId)await db.update('invoices',[{id,record:{...record,salesId,customerId}}]);
      return json({id});
    }
    if(input.table==='purchases'){
      const unit=String(record.unit||''),mult=bagPairs[unit]||cartonPairs[unit]||1;
      const pairs=num(record.pairs)||num(record.quantity)*mult;
      const total=unit.includes('bag')?pairs*num(record.price):num(record.total)||num(record.quantity)*num(record.price);
      record.pairs=pairs;record.total=total;
      const [id]=await db.add('purchases',[record]);
      if(!id)return error('Could not save purchase',500);
      const category=unit.includes('bag')?'Uppers':(record.category||'Other');
      const [rawId]=await db.add('rawStock',[{name:record.name||'Purchased material',article:record.article||'',category,unit,quantity:num(record.quantity),totalPairs:pairs,availablePairs:pairs,price:num(record.price),priceUnit:unit.includes('bag')?'per pair':'per unit',minStock:0,sourcePurchase:id,workspaceId,createdAt:new Date().toISOString()}]);
      if(rawId)await db.update('purchases',[{id,record:{...record,rawStockId:rawId}}]);
      await ensureAccount('suppliers',record.supplier,workspaceId);
      return json({id});
    }
    if(input.table==='customers'||input.table==='suppliers'){
      const existing=await findByName(input.table,record.name,workspaceId);
      if(existing)return json({id:existing.id,existing:true});
    }
    const [id]=await db.add(input.table,[record]);
    if(!id)return error('Could not save record',500);
    if(input.table==='payments'){
      record.name=String(record.name||'').trim();
      record.amount=num(record.amount);record.credit=record.type==='Customer'?record.amount:0;record.debit=record.type==='Supplier'?record.amount:0;record.cashDirection=record.type==='Customer'?'IN':'OUT';
      if(record.type==='Customer')await ensureAccount('customers',record.name,workspaceId);
      if(record.type==='Supplier')await ensureAccount('suppliers',record.name,workspaceId);
      await db.update('payments',[{id,record}]);
    }
    return json({id,record});
  }],
  'PUT /api/records/:id':[requireAuth(),ownerOnly(),async({params,body,user})=>{
    const workspaceId=String(user!.userId);
    const input=body as {table?:string;record?:Record<string,any>};
    if(!input.table||!TABLES.includes(input.table)||input.table==='recycle'||!input.record)return error('Invalid update',400);
    const old=await getOwned(input.table,params.id,workspaceId);if(!old)return error('Record not found',404);
    let next:any={...input.record,workspaceId,updatedAt:new Date().toISOString()};
    if(input.table==='production'){
      const oldR:any=old,newOutput=num(next.outputPairs)||(num(next.cartons)*(cartonPairs[next.cartonType]||0)),oldOutput=num(oldR.outputPairs);
      if(same(oldR.article,next.article)){const delta=newOutput-oldOutput;if(delta>0)await adjustUpper(next.article,delta,workspaceId);if(delta<0)await adjustUpper(next.article,delta,workspaceId);}
      else{await adjustUpper(oldR.article,-oldOutput,workspaceId);try{await adjustUpper(next.article,newOutput,workspaceId);}catch(e){await adjustUpper(oldR.article,oldOutput,workspaceId);return error(e instanceof Error?e.message:'Insufficient stock',400);}}
      next.outputPairs=newOutput;next.consumedPairs=newOutput;
      if(oldR.readyId){const ready=await getOwned('readyShoes',oldR.readyId,workspaceId);if(ready)await db.update('readyShoes',[{id:oldR.readyId,record:{...ready,article:next.article,cartonType:next.cartonType,cartons:num(next.cartons),totalPairs:newOutput,availablePairs:newOutput}}]);}
    }
    if(input.table==='rawStock'&&next.category==='Uppers'){const mult=bagPairs[next.unit]||100;next.totalPairs=num(next.quantity)*mult;next.availablePairs=next.totalPairs;}
    if(input.table==='readyShoes'){const pairs=num(next.cartons)*(cartonPairs[next.cartonType]||0);next.totalPairs=pairs;next.availablePairs=Math.min(num((old as any).availablePairs??(old as any).totalPairs),pairs);}
    if(input.table==='invoices'){
      const oldPairs=num((old as any).pairs),newPairs=num(next.cartons)*(cartonPairs[next.cartonType]||0);
      const sameArticle=same((old as any).article,next.article);
      if(sameArticle){
        const delta=newPairs-oldPairs;
        if(delta>0)await consumeReady(next.article,delta,workspaceId);
        if(delta<0)await restoreReady(next.article,-delta,(old as any).readyConsumedFrom,workspaceId);
      }else{
        await restoreReady((old as any).article,oldPairs,(old as any).readyConsumedFrom,workspaceId);
        try{next.readyConsumedFrom=await consumeReady(next.article,newPairs,workspaceId);}catch(e){await consumeReady((old as any).article,oldPairs,workspaceId);return error(e instanceof Error?e.message:'Insufficient Ready Shoes',400);}
      }
      next.pairs=newPairs;next.total=newPairs*num(next.price);
      if((old as any).salesId){const sale=await getOwned('sales',(old as any).salesId,workspaceId);if(sale)await db.update('sales',[{id:(old as any).salesId,record:{...sale,customer:next.customer,article:next.article,cartons:next.cartons,pairs:newPairs,total:next.total,date:next.date,invoiceNumber:next.invoiceNumber}}]);}
      await ensureAccount('customers',next.customer,workspaceId);
    }
    if(input.table==='purchases'){
      const mult=bagPairs[next.unit]||cartonPairs[next.unit]||1;next.pairs=num(next.quantity)*mult;next.total=String(next.unit).includes('bag')?next.pairs*num(next.price):next.pairs?num(next.price)*num(next.quantity):0;
      if((old as any).rawStockId){const raw=await getOwned('rawStock',(old as any).rawStockId,workspaceId);if(raw)await db.update('rawStock',[{id:(old as any).rawStockId,record:{...raw,name:next.name,article:next.article,unit:next.unit,quantity:num(next.quantity),totalPairs:next.pairs,availablePairs:next.pairs,price:num(next.price),priceUnit:String(next.unit).includes('bag')?'per pair':'per unit'}}]);}
      await ensureAccount('suppliers',next.supplier,workspaceId);
    }
    if(input.table==='payments'){
      next.amount=num(next.amount);next.credit=next.type==='Customer'?next.amount:0;next.debit=next.type==='Supplier'?next.amount:0;next.cashDirection=next.type==='Customer'?'IN':'OUT';
      if(next.type==='Customer')await ensureAccount('customers',next.name,workspaceId);
      if(next.type==='Supplier')await ensureAccount('suppliers',next.name,workspaceId);
    }
    const [ok]=await db.update(input.table,[{id:params.id,record:next}]);if(!ok)return error('Could not update record',500);
    return json({ok:true});
  }],
  'DELETE /api/records/:table/:id':[requireAuth(),ownerOnly(),async({params,user})=>{const workspaceId=String(user!.userId);const table=params.table;if(!TABLES.includes(table)||table==='recycle')return error('Invalid table: '+table,400);try{const ok=await deleteRecord(table,params.id,workspaceId);return ok?json({ok:true}):error('Record not found',404);}catch(e){return error(e instanceof Error?e.message:'Delete failed',400);}}],
  'POST /api/recycle/restore':[requireAuth(),ownerOnly(),async({body,user})=>{
    const workspaceId=String(user!.userId);
    const input=body as {id?:string};if(!input.id)return error('Missing recycle id',400);
    const item=await getOwned('recycle',input.id,workspaceId);if(!item)return error('Recycle record not found',404);
    const r:any=item;
    try{
      if(r.originalTable==='production'){await createProduction({...r.record,workspaceId},workspaceId);}
      else if(r.originalTable==='purchases'){
        const rec:any={...r.record,workspaceId};delete rec.id;
        const [newId]=await db.add('purchases',[rec]);if(!newId)throw new Error('Could not restore purchase.');
        const unit=String(rec.unit||''),mult=bagPairs[unit]||cartonPairs[unit]||1,pairs=num(rec.pairs)||num(rec.quantity)*mult;
        const category=unit.includes('bag')?'Uppers':(rec.category||'Other');
        const [rawId]=await db.add('rawStock',[{name:rec.name||'Purchased material',article:rec.article||'',category,unit,quantity:num(rec.quantity),totalPairs:pairs,availablePairs:pairs,price:num(rec.price),minStock:0,sourcePurchase:newId,workspaceId,createdAt:new Date().toISOString()}]);
        if(rawId)await db.update('purchases',[{id:newId,record:{...rec,rawStockId:rawId,pairs,total:unit.includes('bag')?pairs*num(rec.price):num(rec.total)||num(rec.quantity)*num(rec.price)}}]);
        await ensureAccount('suppliers',rec.supplier,workspaceId);
      }else if(r.originalTable==='invoices'){
        const rec:any={...r.record};delete rec.id;
        const customerId=await ensureAccount('customers',rec.customer,workspaceId);
        const consumed=await consumeReady(rec.article,num(rec.pairs),workspaceId);
        rec.readyConsumedFrom=consumed;
        const [newId]=await db.add('invoices',[rec]);if(!newId){await restoreReady(rec.article,num(rec.pairs),consumed,workspaceId);throw new Error('Could not restore invoice.');}
        const [salesId]=await db.add('sales',[{customer:rec.customer,article:rec.article,cartons:rec.cartons,pairs:rec.pairs,total:rec.total,date:rec.date,invoiceNumber:rec.invoiceNumber,invoiceId:newId,workspaceId,createdAt:new Date().toISOString()}]);
        if(salesId)await db.update('invoices',[{id:newId,record:{...rec,salesId,customerId}}]);
      }else{
        const rec:any={...r.record};delete rec.id;
        const [newId]=await db.add(r.originalTable,[rec]);if(!newId)throw new Error('Could not restore record.');
        if(r.originalTable==='payments'){if(rec.type==='Customer')await ensureAccount('customers',rec.name,workspaceId);if(rec.type==='Supplier')await ensureAccount('suppliers',rec.name,workspaceId);}
      }
      await db.delete('recycle',[input.id]);return json({ok:true});
    }catch(e){return error(e instanceof Error?e.message:'Restore failed',400);}
  }],
  'DELETE /api/recycle/:id':[requireAuth(),ownerOnly(),async({params,user})=>{const workspaceId=String(user!.userId);const item=await getOwned('recycle',params.id,workspaceId);if(!item)return error('Recycle record not found',404);const [ok]=await db.delete('recycle',[params.id]);return json({ok:!!ok});}]
});