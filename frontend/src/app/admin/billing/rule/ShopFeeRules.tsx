'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listShops } from '@/lib/adminApi';
import { getShopFeeRule, updateShopFeeRule, resetShopFeeRule, humanLabelFeeRule, FEE_RULE_TYPE_OPTIONS, type FeeRuleType } from '@/lib/billingApi';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function ShopFeeRules() {
 const [search,setSearch]=useState('');
 const [shop,setShop]=useState<{id:string;name:string}|null>(null);
 const [page,setPage]=useState(1);
 const shops=useQuery({queryKey:['fee-rule-shops',search,page],queryFn:()=>listShops({q:search,page,page_size:20})});
 return <section className="mt-6 border border-stone-200 bg-white rounded-lg p-5">
  <h2 className="text-lg font-semibold">Individual seller fees</h2>
  <p className="text-sm text-stone-600 mt-1 mb-4">Find a shop and set its own fee. A rate of zero makes future orders free of platform fees.</p>
  <Input label="Find shop by name or slug" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} />
  {shops.isPending ? <p role="status">Loading shops…</p> : shops.isError ? <p role="alert">Could not load shops. <button onClick={()=>shops.refetch()}>Try again</button></p> : <>
   <div className="flex flex-wrap gap-2 my-3">{shops.data.data.map(s=><button type="button" key={s.id} onClick={()=>setShop(s)} aria-pressed={shop?.id===s.id} className={`border rounded-md px-3 py-2 text-sm ${shop?.id===s.id?'bg-teal-50 border-teal-600':'border-stone-200'}`}>{s.name} <span className="text-stone-500">/{s.slug}</span></button>)}</div>
   {shops.data.data.length===0 && <p className="text-sm my-3">No shops found.</p>}
   <div className="flex gap-2 mb-4"><Button size="sm" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</Button><span className="text-sm self-center">Page {page}</span><Button size="sm" disabled={page*20>=shops.data.pagination.total} onClick={()=>setPage(page+1)}>Next</Button></div>
  </>}
  {shop && <Editor key={shop.id} shop={shop} />}
 </section>;
}
function Editor({shop}:{shop:{id:string;name:string}}) {
 const qc=useQueryClient();
 const rule=useQuery({queryKey:['shop-fee-rule',shop.id],queryFn:()=>getShopFeeRule(shop.id)});
 const [type,setType]=useState<FeeRuleType>('percentage');
 const [value,setValue]=useState('');
 const [message,setMessage]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function save(reset=false) {
  setBusy(true);setError('');setMessage('');
  try {const result=reset?await resetShopFeeRule(shop.id):await updateShopFeeRule(shop.id,{rule_type:type,value});qc.setQueryData(['shop-fee-rule',shop.id],result);setMessage(reset?'Shop now follows the platform default for future orders.':'Individual rate saved for future orders.');}
  catch(e){setError(e instanceof Error?e.message:'Could not save rule.');}finally{setBusy(false);}
 }
 return <div className="border-t pt-4">
  <h3 className="font-semibold">{shop.name}</h3>
  {rule.isPending?<p>Loading current rate…</p>:rule.isError?<p role="alert">Could not load current rate. <button onClick={()=>rule.refetch()}>Try again</button></p>:<>
   <p className="text-sm text-stone-600 my-2">Current effective rate: {humanLabelFeeRule(rule.data)}</p>
   <form className="grid gap-3 max-w-lg" onSubmit={e=>{e.preventDefault();save();}}>
    <label htmlFor="shop-fee-type" className="text-sm font-medium">Charge this seller by</label>
    <select id="shop-fee-type" className="border rounded-md p-2" value={type} onChange={e=>setType(e.target.value as FeeRuleType)}>{FEE_RULE_TYPE_OPTIONS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select>
    <Input label={type==='percentage'?'Percentage of order total':'BDT per '+(type==='fixed_per_item'?'item unit':'order')} type="number" min="0" max={type==='percentage'?'100':'99999999.9999'} step="0.0001" required value={value} onChange={e=>setValue(e.target.value)} />
    <p className="text-xs text-stone-500">Per-item fees count quantity: 3 units at ৳2 cost ৳6. Existing order rates and unpaid balances remain unchanged.</p>
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>Save seller rate</Button><Button type="button" variant="secondary" disabled={busy} onClick={()=>save(true)}>Use platform default</Button></div>
   </form>
  </>}
  {message&&<p role="status" className="text-sm text-teal-700 mt-3">{message}</p>}{error&&<p role="alert" className="text-sm text-red-700 mt-3">{error}</p>}
 </div>;
}
