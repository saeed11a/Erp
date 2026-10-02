import { useEffect, useMemo, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { supabase } from './src/lib/supabase';
import {
  BarChart3, BookOpen, Box, Boxes, ChevronLeft, ChevronRight, ClipboardList,
  CreditCard, Database, Download, Edit3, Factory, FileText, Gauge, Lock, Menu, Package, Plus,
  RefreshCw, RotateCcw, Settings, ShoppingCart, Trash2,
  TrendingDown, TrendingUp, Users, Wallet, X, LogOut
} from 'lucide-react';

type RecordItem = { id: string; [key: string]: any };

const menu = [
  ['Dashboard','dashboard',Gauge],['Raw Stock','raw',Boxes],['Ready Shoes','ready',Package],
  ['Articles','articles',Box],['Production','production',Factory],['Purchase','purchases',ShoppingCart],
  ['Sales','sales',TrendingUp],['Invoices','invoices',FileText],['Customers Kata','customers',Users],
  ['Suppliers Kata','suppliers',ClipboardList],['Payments','payments',CreditCard],['Supplier Payments','supplierPayments',CreditCard],
  ['Roznamcha','roznamcha',BookOpen],['Kharcha','kharcha',Wallet],['Reports','reports',BarChart3],
  ['Settings','settings',Settings],['Recycle Bin','recycle',Trash2],['Database & Backup','database',Database]
] as const;

const cartonPairs: Record<string,number> = {'12 pairs':12,'18 pairs':18,'24 pairs':24};
const bagPairs: Record<string,number> = {'100 pairs/bag':100,'150 pairs/bag':150};
const paymentMethods = ['Cash','Bank','Cheque','JazzCash','EasyPaisa','Account'];

function App(){
      useEffect(() => {
    const handleDeepLink = async (event: any) => {
      const url = event.url;

      if (!url.startsWith('com.hiker.shoesfactory://login-callback')) {
        return;
      }

      const hash = url.split('#')[1];

      if (hash) {
        const params = new URLSearchParams(hash);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (access_token && refresh_token) {
          await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          return;
        }
      }

      const query = url.split('?')[1];

      if (query) {
        const params = new URLSearchParams(query);
        const code = params.get('code');

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      }
    };

    const listener = CapacitorApp.addListener('appUrlOpen', handleDeepLink);

    return () => {
      listener.then(handle => handle.remove());
    };
  }, []);
  const [page,setPage]=useState('dashboard');
  const [records,setRecords]=useState<Record<string,RecordItem[]>>({});
  const [profileOpen,setProfileOpen]=useState(false);
  const [profileEditOpen,setProfileEditOpen]=useState(false);
  const [loading,setLoading]=useState(true);
  const [editRecord,setEditRecord]=useState<RecordItem|null>(null);
  const [editTable,setEditTable]=useState('');
  const [account,setAccount]=useState<{type:'customer'|'supplier',name:string}|null>(null);
  const [notice,setNotice]=useState('');
  const [pinUnlocked,setPinUnlocked]=useState(false);
  const [user,setUser]=useState<any>(null);
  const [authReady,setAuthReady]=useState(false);

  const load = async () => {
  setLoading(true);

  try {
    const {
      data: { user: supabaseUser },
      error: userError
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!supabaseUser) {
      throw new Error('No signed-in user.');
    }

    const { data, error } = await supabase
      .from('erp_records')
      .select('id, table_name, data')
      .eq('user_id', supabaseUser.id);

    if (error) throw error;

    const grouped: Record<string, RecordItem[]> = {};

    (data || []).forEach((row) => {
      if (!grouped[row.table_name]) {
        grouped[row.table_name] = [];
      }

      grouped[row.table_name].push({
        id: row.id,
        ...(row.data || {})
      });
    });

    setRecords(grouped);
  } catch (e) {
    console.error('LOAD ERROR:', e);
    setNotice('Could not load ERP data.');
  } finally {
    setLoading(false);
  }
};
  useEffect(() => {
    let active = true;

    const updateUser = (supabaseUser: any) => {
      if (!active) return;

      
setUser(
  supabaseUser
    ? {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name:
          supabaseUser.user_metadata?.full_name ||
          supabaseUser.user_metadata?.name ||
          supabaseUser.email ||
          'User',
        avatar:
          supabaseUser.user_metadata?.avatar_url ||
          supabaseUser.user_metadata?.picture ||
          ''
      }
    : null
);
      setAuthReady(true);
    };

    (async () => {
      const {
        data: { user: supabaseUser }
      } = await supabase.auth.getUser();

      updateUser(supabaseUser);
    })();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      updateUser(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
  if (user) load();
}, [user]);

const save = async (table: string, record: Record<string, any>) => {
  try {
    const {
      data: { user: supabaseUser },
      error: userError
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!supabaseUser) {
      throw new Error('No signed-in user.');
    }

    const { error } = await supabase
      .from('erp_records')
      .insert({
        user_id: supabaseUser.id,
        table_name: table,
        data: record
      });

    if (error) throw error;

    await load();
    setNotice('Saved successfully.');
  } catch (e) {
    console.error('SAVE ERROR:', e);
    setNotice('Save failed. Please try again.');
  }
};

  const update = async (
  table: string,
  id: string,
  record: Record<string, any>
) => {
  try {
    const {
      data: { user: supabaseUser },
      error: userError
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!supabaseUser) {
      throw new Error('No signed-in user.');
    }

    const { error } = await supabase
      .from('erp_records')
      .update({
        data: record
      })
      .eq('id', id)
      .eq('user_id', supabaseUser.id);

    if (error) throw error;

    await load();
    setEditRecord(null);
    setNotice('Updated successfully.');
  } catch (e) {
    console.error('UPDATE ERROR:', e);
    setNotice('Update failed.');
  }
};

const remove = async (table: string, id: string) => {
  if (!confirm('Move this record to Recycle Bin?')) return;

  try {
    const {
      data: { user: supabaseUser },
      error: userError
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!supabaseUser) {
      throw new Error('No signed-in user.');
    }

    const { data: record, error: fetchError } = await supabase
      .from('erp_records')
      .select('table_name, data')
      .eq('id', id)
      .eq('user_id', supabaseUser.id)
      .single();

    if (fetchError) throw fetchError;

    const { error: recycleError } = await supabase
      .from('erp_records')
      .insert({
        user_id: supabaseUser.id,
        table_name: 'recycle',
        data: {
          originalTable: table,
          originalId: id,
          originalRecord: record.data,
          deletedAt: new Date().toISOString()
        }
      });

    if (recycleError) throw recycleError;

    const { error: deleteError } = await supabase
      .from('erp_records')
      .delete()
      .eq('id', id)
      .eq('user_id', supabaseUser.id);

    if (deleteError) throw deleteError;

    await load();
    setNotice('Moved to Recycle Bin.');
  } catch (e: any) {
    console.error('REMOVE ERROR:', e);
    setNotice('Delete failed: ' + (e?.message || 'Unknown error.'));
  }
};
  const openEdit=(table:string,row:RecordItem)=>{setEditTable(table);setEditRecord(row);};
  const filtered=(table:string)=>(records[table]||[]);
  const currentLabel=menu.find(x=>x[1]===page)?.[0]||'Dashboard';

  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3000);return()=>clearTimeout(t);},[notice]);

  if(!authReady)return <div className="pin-gate"><div className="pin-card"><div className="logo">H+</div><h1>HIKER+ ERP</h1><p>Checking your secure Google account…</p></div></div>;
  if(!user)return <GoogleLoginGate onSignedIn={setUser}/>;
  if(!pinUnlocked)return <PinGate onUnlock={()=>setPinUnlocked(true)}/>;
  return <div className="app-shell">

    <Sidebar
  page={page}
  setPage={p => {
    setPage(p);
    setAccount(null);
  }}
/>

<main className="main">

  <header className="topbar">

    <button
      className="mobile-menu"
      onClick={() =>
        window.dispatchEvent(new Event('open-sidebar'))
      }
    >
      <Menu size={24} />
    </button>

    <div>
      <div className="eyebrow">
        HIKER SHOES • FACTORY OPERATIONS
      </div>

      <h1>
        {account
          ? (account.type === 'customer'
              ? 'Customer Kata'
              : 'Supplier Kata')
          : currentLabel}
      </h1>
    </div>

    <div className="top-actions">

      <button
        className="icon-btn"
        onClick={load}
        title="Refresh"
      >
        <RefreshCw size={21} />
      </button>

      <div className="profile-menu">

        <button
          className="profile-trigger"
          onClick={() => setProfileOpen(v => !v)}
        >
          <div className="profile-avatar">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt=""
              />
            ) : (
              String(user.name || user.email || 'H')
                .slice(0, 1)
                .toUpperCase()
            )}
          </div>

          <span className="profile-name">
            {user.name || user.email}
          </span>

          <ChevronRight
            size={16}
            className="profile-chevron"
          />
        </button>

        {profileOpen && (
          <div className="profile-dropdown">

            <button
              onClick={() => {
                setProfileOpen(false);
                setProfileEditOpen(true);
              }}
            >
              Profile
            </button>

            <button
              onClick={() => {
                setProfileOpen(false);
                setProfileEditOpen(true);
              }}
            >
              Change Profile
            </button>

            <button
              onClick={() => {
                setProfileOpen(false);
                setNotice('Switch Account will be added next.');
              }}
            >
              Switch Account
            </button>

            <button
              onClick={() => {
                setProfileOpen(false);
                setNotice('Role & Permissions will be added next.');
              }}
            >
              Role & Permissions
            </button>

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                setUser(null);
                setProfileOpen(false);
              }}
            >
              Logout
            </button>

          </div>
        )}

      </div>

    </div>

  </header>
      <div className="content">
        {notice&&<div className="notice">{notice}</div>}
        {loading?<div className="loading">Loading HIKER ERP…</div>:account?
          <AccountDetail type={account.type} name={account.name} records={records} onBack={()=>setAccount(null)}/>:
          <>
            {page==='dashboard'&&<Dashboard records={records} setPage={setPage}/>}
            {page==='raw'&&<RawStock records={records} save={save} remove={remove} openEdit={openEdit}/>}
            {page==='ready'&&<ReadyShoes records={records} save={save} remove={remove} openEdit={openEdit}/>}
            {page==='articles'&&<Articles records={records}/>}
            {page==='production'&&<Production records={records} save={save} remove={remove} openEdit={openEdit}/>}
            {page==='purchases' && ( <Purchases  records={records}    save={save}   update={update}    remove={remove}    openEdit={openEdit}  />)}
            {page==='sales'&&<SimpleTable title="Sales" table="sales" rows={filtered('sales')} remove={remove} openEdit={openEdit}/>}
            {page==='invoices'&&<Invoices records={records} save={save} remove={remove} openEdit={openEdit}/>}
            {page==='customers'&&<Kata title="Customers Kata" table="customers" records={records} save={save} remove={remove} openEdit={openEdit} openAccount={name=>setAccount({type:'customer',name})}/>}
            {page==='suppliers'&&<Kata title="Suppliers Kata" table="suppliers" records={records} save={save} remove={remove} openEdit={openEdit} openAccount={name=>setAccount({type:'supplier',name})}/>}
            {page==='payments'&&<Payments records={records} save={save} remove={remove} openEdit={openEdit}/>} 
            {page==='supplierPayments'&&<SupplierPayments records={records} remove={remove} openEdit={openEdit}/>} {page==='roznamcha'&&<Roznamcha records={records} save={save} remove={remove} openEdit={openEdit}/>}
            {page==='kharcha'&&<Kharcha records={records} save={save} remove={remove} openEdit={openEdit}/>}
            {page==='reports'&&<Reports records={records}/>}            {page==='settings'&&<SettingsPage/>}
            {page==='recycle'&&<Recycle records={records} load={load} setNotice={setNotice}/>} 
            {page==='database'&&<DatabasePage records={records} load={load} setNotice={setNotice}/>} </>}
      </div>
    </main>

{editRecord&&<EditModal
  table={editTable}
  record={editRecord}
  onClose={()=>setEditRecord(null)}
  onSave={(r)=>update(editTable,editRecord.id,r)}
/>}

{profileEditOpen && (
  <div
    className="profile-edit-overlay"
    onClick={() => setProfileEditOpen(false)}
  >
    <div
      className="profile-edit-card"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="profile-edit-header">
        <div>
          <h2>Edit Profile</h2>
          <p>Update your profile information.</p>
        </div>

        <button
          className="icon-btn"
          onClick={() => setProfileEditOpen(false)}
        >
          <X size={18} />
        </button>
      </div>

      <div className="profile-edit-avatar">
        {user?.avatar ? (
          <img src={user.avatar} alt="" />
        ) : (
          String(user?.name || user?.email || 'H')
            .slice(0, 1)
            .toUpperCase()
        )}
      </div>

      <div className="profile-edit-info">
        <strong>{user?.name || 'User'}</strong>
        <span>{user?.email || ''}</span>
      </div>

      <button
        className="primary full"
        onClick={() => setProfileEditOpen(false)}
      >
        Done
      </button>
    </div>
  </div>
)}

</div>;
}

function GoogleLoginGate({onSignedIn}:any){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const signIn=async()=>{
    setBusy(true);setError('');
try{
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'com.hiker.shoesfactory://login-callback'
    }
  });

  if (error) throw error;
    }catch(e:any){
      if(e?.code==='popup_blocked')setError('Please allow the Google sign-in popup and try again.');
      else if(e?.code==='popup_closed')setError('Google sign-in was cancelled.');
      else setError('Google sign-in could not be completed. Please try again.');
    }finally{setBusy(false);}
  };
  return <div className="pin-gate"><div className="pin-card"><div className="logo">H+</div><h1>HIKER+ ERP</h1><p>Sign in with your Google account. Each Google account has its own private ERP workspace and data.</p><button className="primary full" onClick={signIn} disabled={busy}>{busy?'Signing in…':'Continue with Google'}</button>{error&&<div className="pin-error">{error}</div>}<small style={{display:'block',marginTop:14}}>Your ERP records stay in the cloud and are separated by Google account. The same Google account can use the same workspace on another device.</small></div></div>;
}

function PinGate({onUnlock}:any){
  const [pin,setPin]=useState('');
  const [error,setError]=useState('');

  const firstTime = !localStorage.getItem('hiker_pin_initialized');

  const submit=()=>{
    const saved=localStorage.getItem('hiker_pin')||'1234';

    if(pin===saved){
      setError('');

      if(firstTime){
        localStorage.setItem('hiker_pin_initialized','true');
      }

      onUnlock();
    }else{
      setError('Incorrect PIN.');
      setPin('');
    }
  };

  return (
    <div className="pin-gate">
      <div className="pin-card">

        <div className="logo">H+</div>

        <h1>HIKER+ ERP</h1>

        <p>
          Enter your PIN to open the factory system.
        </p>

        {firstTime && (
          <div className="pin-default">
            Default PIN: <b>1234</b>
          </div>
        )}

        <input
          autoFocus
          inputMode="numeric"
          type="password"
          value={pin}
          onChange={e=>setPin(e.target.value)}
          onKeyDown={e=>{
            if(e.key==='Enter')submit();
          }}
          placeholder="PIN code"
        />

        <button
          className="primary full"
          onClick={submit}
        >
          <Lock size={18}/>
          Unlock Dashboard
        </button>

        {error&&(
          <div className="pin-error">
            {error}
          </div>
        )}

      </div>
    </div>
  );
}

function Sidebar({page,setPage}:{page:string;setPage:(p:string)=>void}){
  const [open,setOpen]=useState(false);
  useEffect(()=>{const f=()=>setOpen(true);window.addEventListener('open-sidebar',f);return()=>window.removeEventListener('open-sidebar',f);},[]);
  return <aside className={'sidebar '+(open?'open':'')}>
    <div className="brand"><div className="logo">H+</div><div><strong>HIKER+</strong><span>FACTORY ERP</span></div><button onClick={()=>setOpen(false)}><X/></button></div>
    <div className="section-title">MAIN MENU</div>
    <nav>{menu.map(([label,key,Icon])=><button key={key} className={page===key?'active':''} onClick={()=>{setPage(key);setOpen(false);}}><Icon size={23}/><span>{label}</span>{key==='raw'&&<ChevronRight size={17} className="nav-arrow"/>}</button>)}</nav>
  </aside>;
}

function Dashboard({records,setPage}:any){
  const raw=records.rawStock||[],ready=records.readyShoes||[],prod=records.production||[],sales=records.sales||[];
  const rawPairs=raw.filter((r:any)=>r.category==='Uppers').reduce((s:number,r:any)=>s+Number(r.availablePairs??r.totalPairs??0),0);
  const readyPairs=ready.reduce((s:number,r:any)=>s+Number(r.availablePairs??r.totalPairs??0),0);
  const today=new Date().toISOString().slice(0,10);
  const salesToday=sales.filter((r:any)=>r.date===today).reduce((s:number,r:any)=>s+Number(r.total||0),0);
  const low=raw.filter((r:any)=>Number(r.availablePairs??r.totalPairs??r.quantity??0)<=Number(r.minStock||0));
  const cards=[['Raw Uppers',rawPairs.toLocaleString()+' pairs'],['Ready Shoes',readyPairs.toLocaleString()+' pairs'],['Production',prod.reduce((s:number,r:any)=>s+Number(r.outputPairs||0),0).toLocaleString()+' pairs'],['Sales Today','PKR '+salesToday.toLocaleString()],['Customers',uniqueNames(records.customers||[]).length],['Suppliers',uniqueNames(records.suppliers||[]).length]];
  const chartDays=lastDays(7), chart=chartDays.map(d=>sales.filter((r:any)=>r.date===d).reduce((s:number,r:any)=>s+Number(r.total||0),0));
  return <div>
    <PageTitle title="Factory overview" sub="Live stock, production and cash position."/>
    <div className="quick-grid">{cards.map(([a,b])=><div className="metric" key={String(a)}><span>{a}</span><strong>{b}</strong></div>)}</div>
    <div className="grid-2">
      <div className="panel"><div className="panel-head"><div><b>Sales by date</b><small>Daily sales movement up / down</small></div><TrendingUp size={20}/></div><div className="chart">
        {chart.map((v,i)=><div className="bar-wrap" key={chartDays[i]}><div className="bar" style={{height:Math.max(8,Math.min(170,v/(Math.max(...chart,1))*170))+'px'}}/><span>{chartDays[i].slice(5)}</span></div>)}
      </div></div>
      <div className="panel"><div className="panel-head"><div><b>Low stock</b><small>Items at or below minimum</small></div><TrendingDown size={20}/></div>
        {low.length?<>{low.slice(0,8).map((r:any)=><div className="list-row" key={r.id}><div><b>{r.article||r.name}</b><small>{r.name}</small></div><strong>{Number((r.availablePairs ?? r.totalPairs ?? r.quantity) || 0).toLocaleString()}</strong></div>)}</>:<Empty text="No low-stock items."/>}
      </div>
    </div>
    <div className="panel"><div className="panel-head"><div><b>Quick actions</b><small>Open daily factory workflows</small></div></div><div className="action-grid">
      {[['New Purchase','purchases'],['New Production','production'],['New Invoice','invoices'],['Customer Payment','payments'],['Daily Kharcha','kharcha'],['View Reports','reports']].map(([a,k])=><button key={k} onClick={()=>setPage(k)}><Plus size={18}/>{a}</button>)}
    </div></div>
  </div>;
}

function RawStock({records,save,remove,openEdit}:any){
  const [cat,setCat]=useState('Uppers'),[showForm,setShowForm]=useState(false);
  const rows=(records.rawStock||[]).filter((r:any)=>r.category===cat);
  return <div><PageTitle title="Raw Stock" sub="Separate stock pages for Uppers, Chemical and Manual categories."/>
    <div className="tabs">{['Uppers','Chemical','Other'].map(x=><button className={cat===x?'selected':''} onClick={()=>{setCat(x);setShowForm(false);}} key={x}>{x}</button>)}</div>
    <div className="panel"><div className="panel-head"><div><b>{cat}</b><small>{rows.length} records</small></div><button className="primary" onClick={()=>setShowForm(v=>!v)}><Plus size={18}/>{showForm?' Close':' New '+cat}</button></div>
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>Article</th><th>Unit</th><th>Qty</th><th>Current pairs</th><th>Price</th><th>Actions</th></tr></thead><tbody>
        {rows.map((r:any)=><tr key={r.id}><td><b>{r.name}</b></td><td>{r.article||'—'}</td><td>{r.unit}</td><td>{r.quantity}</td><td>{r.category==='Uppers'?Number(r.availablePairs??r.totalPairs??0).toLocaleString():r.quantity}</td><td>{r.price?Number(r.price).toLocaleString():'—'}</td><td><RecordActions onEdit={()=>openEdit('rawStock',r)} onDelete={()=>remove('rawStock',r.id)}/></td></tr>)}
      </tbody></table>{!rows.length&&<Empty text="No records found."/>}</div>
    </div>
    {showForm&&<div className="panel form-panel"><div className="panel-head"><b>New {cat}</b><button className="icon-btn" onClick={()=>setShowForm(false)}><X size={18}/></button></div><RawForm cat={cat} save={async(...args:any[])=>{await save(...args);setShowForm(false);}}/></div>}
  </div>;
}

function RawForm({cat,save}:any){
  const [f,setF]=useState({name:'',article:'',unit:cat==='Uppers'?'100 pairs/bag':'Drums',quantity:'',price:'',minStock:'0'});
  const set=(k:string,v:string)=>setF({...f,[k]:v});
  const mult=cat==='Uppers'?(bagPairs[f.unit]||100):1;
  const total=cat==='Uppers'?(Number(f.quantity)||0)*mult:undefined;
  return <div className="form-grid"><Input label="Name" value={f.name} onChange={v=>set('name',v)}/>{cat==='Uppers'&&<Input label="Article" value={f.article} onChange={v=>set('article',v)}/>}
    <Select label={cat==='Uppers'?'Bag':'Unit'} value={f.unit} options={cat==='Uppers'?['100 pairs/bag','150 pairs/bag']:['Drums','KG','Pieces','Cartons']} onChange={v=>set('unit',v)}/>
    <Input label="Quantity" type="number" value={f.quantity} onChange={v=>set('quantity',v)}/><Input label="Price" type="number" value={f.price} onChange={v=>set('price',v)}/><Input label="Minimum stock" type="number" value={f.minStock} onChange={v=>set('minStock',v)}/>
    {total!==undefined&&<div className="calc">Total pairs: <b>{total.toLocaleString()}</b></div>}
    <button className="primary full" onClick={()=>f.name&&save('rawStock',{...f,category:cat,totalPairs:total??Number(f.quantity),availablePairs:total??Number(f.quantity),createdAt:new Date().toISOString()})}><Plus size={18}/> Save {cat}</button>
  </div>;
}

function ReadyShoes({records,save,remove,openEdit}:any){
  const [showForm,setShowForm]=useState(false),rows=records.readyShoes||[];
  return <div><PageTitle title="Ready Shoes" sub="Cartons automatically convert into pairs. Production also adds ready stock automatically."/>
    <div className="panel"><div className="panel-head"><div><b>Ready Shoes Stock</b><small>{rows.length} records</small></div><button className="primary" onClick={()=>setShowForm(v=>!v)}><Plus size={18}/>{showForm?' Close':' New Ready Shoes'}</button></div>
      {showForm&&<div className="form-panel"><ReadyForm save={async(...args:any[])=>{await save(...args);setShowForm(false);}}/></div>}
      <div className="table-wrap"><table><thead><tr><th>Article</th><th>Carton</th><th>Cartons</th><th>Current pairs</th><th>Source</th><th>Actions</th></tr></thead><tbody>
      {rows.map((r:any)=><tr key={r.id}><td><b>{r.article}</b></td><td>{r.cartonType}</td><td>{r.cartons}</td><td>{Number(r.availablePairs??r.totalPairs??0).toLocaleString()}</td><td>{r.productionId?'Production':'Manual'}</td><td><RecordActions onEdit={()=>openEdit('readyShoes',r)} onDelete={()=>remove('readyShoes',r.id)}/></td></tr>)}
    </tbody></table>{!rows.length&&<Empty text="No ready shoes found."/>}</div></div>
  </div>;
}

function ReadyForm({save}:any){
  const [f,setF]=useState({name:'',article:'',cartonType:'24 pairs',cartons:''});const pairs=(Number(f.cartons)||0)*cartonPairs[f.cartonType];
  return <div className="form-grid"><Input label="Name" value={f.name} onChange={v=>setF({...f,name:v})}/><Input label="Article" value={f.article} onChange={v=>setF({...f,article:v})}/>
    <Select label="Carton" value={f.cartonType} options={Object.keys(cartonPairs)} onChange={v=>setF({...f,cartonType:v})}/><Input label="Carton quantity" type="number" value={f.cartons} onChange={v=>setF({...f,cartons:v})}/>
    <div className="calc">Pairs: <b>{pairs.toLocaleString()}</b></div><button className="primary full" onClick={()=>f.article&&save('readyShoes',{...f,totalPairs:pairs,availablePairs:pairs,date:new Date().toISOString().slice(0,10),createdAt:new Date().toISOString()})}>Save Ready Shoes</button>
  </div>;
}

function Articles({records}:any){
  const articles=useMemo(()=>{const m=new Map<string,number>();(records.rawStock||[]).filter((r:any)=>r.category==='Uppers'&&r.article).forEach((r:any)=>m.set(r.article,(m.get(r.article)||0)+Number(r.availablePairs??r.totalPairs??0)));return [...m.entries()];},[records]);
  return <div><PageTitle title="Articles" sub="Article numbers are automatically collected from Uppers stock."/><div className="panel"><div className="table-wrap"><table><thead><tr><th>Article</th><th>Current upper quantity</th></tr></thead><tbody>{articles.map(([a,q])=><tr key={a}><td><b>{a}</b></td><td>{q.toLocaleString()} pairs</td></tr>)}</tbody></table>{!articles.length&&<Empty text="Add an Upper with an article number first."/>}</div></div></div>;
}

function Production({records,save,remove,openEdit}:any){
  const uppers=useMemo(()=>{const m=new Map<string,any>();(records.rawStock||[]).filter((r:any)=>r.category==='Uppers'&&r.article).forEach((r:any)=>{const key=String(r.article).trim().toLowerCase();const old=m.get(key)||{article:String(r.article).trim(),bags:0,pairs:0};const avail=Number(r.availablePairs??r.totalPairs??0);old.bags+=Math.floor(avail/(bagPairs[r.unit]||100));old.pairs+=avail;m.set(key,old);});return [...m.values()];},[records]);
  const [article,setArticle]=useState(''),[cartonType,setCartonType]=useState('24 pairs'),[cartons,setCartons]=useState(''),[showForm,setShowForm]=useState(false);
  const chosen=uppers.find((x:any)=>same(x.article,article)),output=(Number(cartons)||0)*cartonPairs[cartonType],rows=records.production||[];
  const canProduce=Number(chosen?.pairs||0)>=output&&output>0;const maxProduce=Math.floor(Number(chosen?.pairs)||0);
  return <div><PageTitle title="Production" sub="Select an Upper article, view stock, enter production cartons, and automatically create Ready Shoes."/>
    <div className="panel"><div className="panel-head"><div><b>Production History</b><small>{rows.length} records</small></div><button className="primary" onClick={()=>setShowForm(v=>!v)}><Plus size={18}/>{showForm?' Close':' New Production'}</button></div>
    {showForm&&<div className="form-panel"><div className="form-grid"><Select label="Article" value={article} options={uppers.map((x:any)=>x.article)} onChange={setArticle}/>
      <div className="stock-preview"><span>Available Upper bags</span><b>{chosen?.bags||0}</b><span>Available Upper pairs</span><b>{Number(chosen?.pairs||0).toLocaleString()}</b><span>Max producible pairs</span><b>{maxProduce.toLocaleString()}</b></div>
      <Select label="Ready carton" value={cartonType} options={Object.keys(cartonPairs)} onChange={setCartonType}/><Input label="Production cartons" type="number" value={cartons} onChange={setCartons}/>
      <div className="calc">Ready to produce for <b>{article||"—"}</b>: <b>{maxProduce.toLocaleString()} pairs</b> • Output: <b>{output.toLocaleString()} pairs</b></div>
      <button
  className="primary full"
  disabled={!chosen || output <= 0 || output > maxProduce}
  onClick={async () => {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);

    await save('production', {
      article,
      cartonType,
      cartons: Number(cartons),
      outputPairs: output,
      date,
      createdAt: now.toISOString()
    });

    await save('readyShoes', {
      name: article,
      article,
      cartonType,
      cartons: Number(cartons),
      totalPairs: output,
      availablePairs: output,
      date,
      createdAt: now.toISOString(),
      productionSource: true
    });

    setShowForm(false);
  }}
>
  <Factory size={18}/>
  Complete Production & Add Ready Shoes
</button>
      
    </div></div>}
    <div className="table-wrap"><table><thead><tr><th>Article</th><th>Production cartons</th><th>Output pairs</th><th>Date</th><th>Actions</th></tr></thead><tbody>
      {rows.map((r:any)=><tr key={r.id}><td><b>{r.article}</b></td><td>{r.cartons} × {r.cartonType}</td><td>{Number(r.outputPairs||0).toLocaleString()}</td><td>{r.date}</td><td><RecordActions onEdit={()=>openEdit('production',r)} onDelete={()=>remove('production',r.id)}/></td></tr>)}
    </tbody></table>{!rows.length&&<Empty text="No production records found."/>}</div></div>
  </div>;
}
function Purchases({records,save,update,remove,openEdit}:any){
  const rawRows=Array.isArray(records?.rawStock)?records.rawStock:[];
  const purchaseRows=Array.isArray(records?.purchases)?records.purchases:[];

  const categories=useMemo(()=>{
    const s=new Set<string>(['Uppers','Chemical','Other']);

    rawRows.forEach((r:any)=>{
      const c=String(r?.category||'').trim();
      if(c)s.add(c);
    });

    return Array.from(s);
  },[rawRows]);

  // Purchase form is CLOSED by default.
  const [showPurchaseForm,setShowPurchaseForm]=useState(false);

  const [category,setCategory]=useState('Uppers');
  const [selectedId,setSelectedId]=useState('');
  const [isNew,setIsNew]=useState(true);

  const [f,setF]=useState({
    supplier:'',
    name:'',
    article:'',
    unit:'100 pairs/bag',
    quantity:'',
    price:''
  });

  const matching=useMemo(
    ()=>rawRows.filter(
      (r:any)=>
        String(r?.category||'').trim().toLowerCase()===
        category.toLowerCase()
    ),
    [rawRows,category]
  );

  const units=useMemo(()=>{
    const u:string[]=[];

    matching.forEach((r:any)=>{
      const x=String(r?.unit||'');
      if(x&&!u.includes(x))u.push(x);
    });

    if(category==='Uppers'){
      ['100 pairs/bag','150 pairs/bag'].forEach(x=>{
        if(!u.includes(x))u.push(x);
      });
    }else if(!u.length){
      u.push('Drums','KG','Pieces','Cartons');
    }

    return u;
  },[matching,category]);

  const normalizePurchaseValue=(value:any)=>
    String(value||'')
      .trim()
      .replace(/\s+/g,' ')
      .toLowerCase();

  const resetPurchaseForm=()=>{
    setSelectedId('');
    setIsNew(true);

    setF({
      supplier:'',
      name:'',
      article:'',
      unit:category==='Uppers'?'100 pairs/bag':'Drums',
      quantity:'',
      price:''
    });
  };

  const chooseCategory=(c:string)=>{
    setCategory(c);

    const rows=rawRows.filter(
      (r:any)=>
        String(r?.category||'').trim().toLowerCase()===
        c.toLowerCase()
    );

    const first=rows[0];

    if(first){
      setSelectedId(String(first.id));
      setIsNew(false);

      setF(v=>({
        ...v,
        name:String(first.name||''),
        article:String(first.article||''),
        unit:String(first.unit||(
          c==='Uppers'?'100 pairs/bag':'Drums'
        )),
        quantity:'',
        price:''
      }));
    }else{
      setSelectedId('');
      setIsNew(true);

      setF(v=>({
        ...v,
        name:'',
        article:'',
        unit:c==='Uppers'?'100 pairs/bag':'Drums',
        quantity:'',
        price:''
      }));
    }
  };

  const chooseItem=(id:string)=>{
    if(id==='__new__'){
      setSelectedId('');
      setIsNew(true);

      setF(v=>({
        ...v,
        name:'',
        article:'',

                unit:units[0]||'',
        quantity:'',
        price:''
      }));

      return;
    }

    const row=matching.find(
      (r:any)=>String(r.id)===id
    );

    if(!row)return;

    setSelectedId(id);
    setIsNew(false);

    setF(v=>({
      ...v,
      name:String(row.name||''),
      article:String(row.article||''),
      unit:String(row.unit||units[0]||''),
      quantity:'',
      price:''
    }));
  };

  const mult=bagPairs[f.unit]||cartonPairs[f.unit]||1;
  const quantity=Number(f.quantity)||0;
  const pairs=quantity*mult;
  const price=Number(f.price)||0;

  const total=
    f.unit.includes('bag')
      ? pairs*price
      : quantity*price;

  const valid=Boolean(
    f.supplier.trim() &&
    f.name.trim() &&
    quantity>0 &&
    f.price!=='' &&
    price>=0
  );

  const savePurchase=async()=>{
    if(!valid)return;

    try{
      const now=new Date().toISOString();

      const cleanSupplier=f.supplier.trim().replace(/\s+/g,' ');
      const cleanName=f.name.trim().replace(/\s+/g,' ');
      const cleanArticle=f.article.trim().replace(/\s+/g,' ');

      /*
       * 1. Save the purchase transaction.
       * This remains an independent Purchase record.
       */
      await save('purchases',{
        supplier:cleanSupplier,
        name:cleanName,
        article:cleanArticle,
        unit:f.unit,
        quantity,
        price,
        category,
        pairs,
        total,
        date:now.slice(0,10),
        time:new Date().toLocaleTimeString(),
        createdAt:now
      });

      /*
       * 2. Find the matching Raw Stock item.
       *
       * Name + Article are compared case-insensitively
       * and repeated spaces are ignored.
       */
      const existing=matching.find(
        (r:any)=>
          normalizePurchaseValue(r.name)===
            normalizePurchaseValue(cleanName) &&
          normalizePurchaseValue(r.article)===
            normalizePurchaseValue(cleanArticle)
      );

      /*
       * 3. Add the purchase quantity to existing Raw Stock.
       */
      if(existing){
        const oldQuantity=Number(existing.quantity)||0;

        const oldPairs=Number(
          existing.availablePairs??
          existing.totalPairs??
          0
        );

        const addedPairs=
          category==='Uppers'
            ? pairs
            : quantity;

        const newQuantity=
          oldQuantity+quantity;

        const newPairs=
          oldPairs+addedPairs;

        await update(
          'rawStock',
          String(existing.id),
          {
            ...existing,

            name:cleanName,
            article:
              category==='Uppers'
                ? cleanArticle
                : '',

            unit:f.unit,
            category,

            quantity:newQuantity,

            totalPairs:newPairs,
            availablePairs:newPairs,

            price,

            updatedAt:now
          }
        );
      }

      /*
       * 4. If the item does not exist in Raw Stock,
       * create it automatically.
       */
      else{
        const stockPairs=
          category==='Uppers'
            ? pairs
            : quantity;

        await save('rawStock',{
          name:cleanName,

          article:
            category==='Uppers'
              ? cleanArticle
              : '',

          unit:f.unit,
          quantity,
          price,
          minStock:'0',
          category,

          totalPairs:stockPairs,
          availablePairs:stockPairs,

          createdAt:now,
          updatedAt:now
        });
      }

      /*
       * Articles are automatically generated from
       * Raw Stock, so no separate Articles record
       * is required here.
       */

      setShowPurchaseForm(false);
      resetPurchaseForm();

    }catch(error){
      console.error(error);
    }
  };

  return (
    <div>
      <PageTitle
        title="Purchase"
        sub="Create purchases from Raw Stock. Choose an existing item to auto-fill details, or create a new item."
      />

      <div className="panel">
        <div className="panel-head">
          <div>
            <b>Purchase</b>
            <small>{purchaseRows.length} purchase records</small>
          </div>

          <button
            className="primary"
            onClick={()=>{
              setShowPurchaseForm(true);
              resetPurchaseForm();
            }}
          >
            <Plus size={18}/>
            New Purchase
          </button>
        </div>

        {showPurchaseForm&&(
          <div className="form-panel">
            <div className="form-grid">

              <Input
                label="Supplier"
                value={f.supplier}
                onChange={(v:string)=>
                  setF({...f,supplier:v})
                }
              />

              <Select
                label="Raw Stock Category"
                value={category}
                options={categories}
                onChange={chooseCategory}
              />

              <Select
                label="Raw Stock Item"
                value={
                  isNew
                    ? '__new__'
                    : selectedId||'__new__'
                }
                options={[
                  ...matching.map((r:any)=>({
                    value:String(r.id),
                    label:
                      String(r.name||'Unnamed')+
                      (
                        r.article
                          ? ' • '+String(r.article)
                          : ''
                      )
                  })),
                  {
                    value:'__new__',
                    label:'＋ New Item / Not in Raw Stock'
                  }
                ].map((o:any)=>o.value)}
                onChange={chooseItem}
              />

              <Input
                label="Name / Material"
                value={f.name}
                onChange={(v:string)=>
                  setF({...f,name:v})
                }
              />

              <Input
                label="Article"
                value={f.article}
                onChange={(v:string)=>
                  setF({...f,article:v})
                }
              />

              <Select
                label="Unit"
                value={f.unit}
                options={units}
                onChange={(v:string)=>
                  setF({...f,unit:v})
                }
              />

              <Input
                label="Quantity"
                type="number"
                value={f.quantity}
                onChange={(v:string)=>
                  setF({...f,quantity:v})
                }
              />

              <Input
                label={
                  f.unit.includes('bag')
                    ? 'Price per pair'
                    : 'Price'
                }
                type="number"
                value={f.price}
                onChange={(v:string)=>
                  setF({...f,price:v})
                }
              />

              <div className="calc">
                Category: <b>{category}</b>
                {' • '}
                {isNew
                  ? 'New Raw Stock item'
                  : 'Existing Raw Stock item'}
                {' • '}
                Converted pairs:
                {' '}
                <b>{pairs.toLocaleString()}</b>
                {' • '}
                Total:
                {' '}
                <b>PKR {total.toLocaleString()}</b>
              </div>

              <button
                className="primary full"
                disabled={!valid}
                onClick={savePurchase}
              >
                <Plus size={18}/>
                Save Purchase
              </button>

            </div>
          </div>
        )}
      </div>

      <SimpleTable
        title="Purchase Register"
        table="purchases"
        rows={purchaseRows}
        remove={remove}
        openEdit={openEdit}
      />
    </div>
  );
        }

function Invoices({records,save,remove,openEdit}:any){
  const [f,setF]=useState({customer:'',article:'',cartonType:'24 pairs',cartons:'',price:''}),[showForm,setShowForm]=useState(false);
  const pairs=(Number(f.cartons)||0)*cartonPairs[f.cartonType],total=pairs*(Number(f.price)||0);
  const articleOptions=useMemo(()=>{const set=new Set<string>();(records.readyShoes||[]).forEach((r:any)=>r.article&&set.add(String(r.article)));(records.articles||[]).forEach((r:any)=>r.article&&set.add(String(r.article)));(records.rawStock||[]).filter((r:any)=>r.category==='Uppers').forEach((r:any)=>r.article&&set.add(String(r.article)));return [...set];},[records]);
  const customerOptions=useMemo(()=>{const m=new Map<string,string>();(records.customers||[]).forEach((r:any)=>{if(r.name&&!m.has(String(r.name).toLowerCase()))m.set(String(r.name).toLowerCase(),String(r.name));});return [...m.values()];},[records]);
  const readyRows=(records.readyShoes||[]).filter((r:any)=>same(r.article,f.article));
  const readyPairs=readyRows.reduce((s:number,r:any)=>s+Number(r.availablePairs??r.totalPairs??0),0);
  const readyCartons=readyRows.reduce((s:number,r:any)=>s+Math.floor(Number(r.availablePairs??r.totalPairs??0)/(cartonPairs[r.cartonType]||1)),0);
  const readyCartonTypes=[...new Set(readyRows.map((r:any)=>r.cartonType).filter(Boolean))] as string[];
  useEffect(()=>{if(!f.article)return;const preferred=readyRows.find((r:any)=>Number(r.availablePairs??r.totalPairs??0)>0)?.cartonType;if(preferred&&preferred!==f.cartonType)setF((x:any)=>({...x,cartonType:preferred}));},[f.article,records.readyShoes]);
  const customerExists=customerOptions.some((n:string)=>same(n,f.customer));
  const canInvoice=Boolean(f.customer&&f.article&&pairs>0&&pairs<=readyPairs);
  return <div><PageTitle title="Invoices" sub="Banam = invoice/debit. Customer must pay. Banam is red; Jamma/payment credit is blue."/>
    <div className="panel"><div className="panel-head"><div><b>Invoice Register</b><small>{(records.invoices||[]).length} records</small></div><button className="primary" onClick={()=>setShowForm(v=>!v)}><Plus size={18}/>{showForm?' Close':' New Invoice'}</button></div>
    {showForm&&<div className="form-panel"><div className="form-grid">
      <label className="field"><span>Customer</span><input list="invoice-customers" value={f.customer} onChange={e=>setF({...f,customer:e.target.value})}/><datalist id="invoice-customers">{customerOptions.map((n:string)=><option key={n} value={n}/>)}</datalist><small className={customerExists?'credit-text':'debit-text'}>{customerExists?'Existing customer':'New customer will be created automatically'}</small></label>
      <Select label="Article" value={f.article} options={articleOptions} onChange={v=>setF({...f,article:v})}/>
      <div className="stock-available"><span>Ready Shoes available for {f.article||'selected article'}</span><b>{readyPairs.toLocaleString()} pairs</b><strong>{readyCartons.toLocaleString()} cartons stored</strong>{readyRows.length>0&&<small>{readyRows.map((r:any)=>{const p=Number(r.availablePairs??r.totalPairs??0);return (p>0?(Math.floor(p/(cartonPairs[r.cartonType]||1))+' × '+r.cartonType):'')}).filter(Boolean).join(' • ')}</small>}</div>
      <Select label="Carton" value={f.cartonType} options={readyCartonTypes.length?[...new Set([...readyCartonTypes,...Object.keys(cartonPairs)])]:Object.keys(cartonPairs)} onChange={v=>setF({...f,cartonType:v})}/><Input label="Cartons" type="number" value={f.cartons} onChange={v=>setF({...f,cartons:v})}/><Input label="Price per pair" type="number" value={f.price} onChange={v=>setF({...f,price:v})}/>
      <div className="calc">Pairs: <b>{pairs.toLocaleString()}</b> • Banam Total: <b className="debit-text">PKR {total.toLocaleString()}</b> • {pairs>readyPairs?<span className="debit-text">Insufficient Ready Shoes</span>:<span className="credit-text">Stock available</span>}</div><button className="primary full" disabled={!canInvoice} onClick={async()=>{await save('invoices',{...f,pairs,total,date:new Date().toISOString().slice(0,10),time:new Date().toLocaleTimeString(),invoiceNumber:'INV-'+Date.now(),entryType:'Banam',createdAt:new Date().toISOString()});setShowForm(false);}}><FileText size={18}/> Create invoice (Banam)</button>
    </div></div>}
    <SimpleTable title="" table="invoices" rows={records.invoices||[]} remove={remove} openEdit={openEdit}/>
    </div>
  </div>;
}

function Payments({records,save,remove,openEdit}:any){
  const [f,setF]=useState({type:'Customer',name:'',amount:'',paymentMethod:'Cash',note:''}),[showForm,setShowForm]=useState(false);
  const names=useMemo(()=>{const rows=(f.type==='Customer'?records.customers:records.suppliers)||[];const m=new Map<string,string>();rows.forEach((r:any)=>{const n=String(r.name||'').trim();if(n&&!m.has(n.toLowerCase()))m.set(n.toLowerCase(),n);});return [...m.values()];},[records,f.type]);
  const submit=async()=>{if(!f.name||Number(f.amount)<=0)return;await save('payments',{...f,amount:Number(f.amount),credit:f.type==='Customer'?Number(f.amount):0,debit:f.type==='Supplier'?Number(f.amount):0,date:new Date().toISOString().slice(0,10),time:new Date().toLocaleTimeString(),createdAt:new Date().toISOString()});setF({type:'Customer',name:'',amount:'',paymentMethod:'Cash',note:''});setShowForm(false);};
  return <div><PageTitle title="Payments" sub="Customer Jamma = Credit (blue). Supplier payment = Debit/Banam (red). Choose Cash, Bank, Cheque, JazzCash, EasyPaisa or Account."/>
    <div className="panel"><div className="panel-head"><div><b>Payment Register</b><small>{(records.payments||[]).length} records</small></div><button className="primary" onClick={()=>setShowForm(v=>!v)}><Plus size={18}/>{showForm?' Close':' New Payment'}</button></div>
      {showForm&&<div className="form-panel"><div className="form-grid"><Select label="Payment type" value={f.type} options={['Customer','Supplier']} onChange={v=>setF({...f,type:v,name:''})}/><label className="field"><span>{f.type==='Customer'?'Customer':'Supplier'}</span><input list="payment-accounts" value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="Select existing or type new"/><datalist id="payment-accounts">{names.map((n:string)=><option key={n} value={n}/>)}</datalist></label><Input label="Amount" type="number" value={f.amount} onChange={v=>setF({...f,amount:v})}/><Select label="Payment method" value={f.paymentMethod} options={paymentMethods} onChange={v=>setF({...f,paymentMethod:v})}/><Input label="Note" value={f.note} onChange={v=>setF({...f,note:v})}/><div className="calc">{f.type==='Customer'?<span className="credit-text">Jamma / Credit: PKR {Number(f.amount||0).toLocaleString()}</span>:<span className="debit-text">Banam / Debit: PKR {Number(f.amount||0).toLocaleString()}</span>}</div>
      <button className="primary full" onClick={submit}><CreditCard size={18}/> Save payment</button></div></div>}
    <SimpleTable title="" table="payments" rows={records.payments||[]} remove={remove} openEdit={openEdit}/>
    </div>
  </div>;
}

function Roznamcha({records,save,remove,openEdit}:any){
  const [showForm,setShowForm]=useState(false);
  const payments=records.payments||[],expenses=records.expenses||[];
  const ins=payments.filter((p:any)=>p.type==='Customer').reduce((s:number,p:any)=>s+Number(p.amount||0),0);
  const outs=expenses.reduce((s:number,p:any)=>s+Number(p.amount||0),0);
  const submit=async(type:string,name:string,amount:string,note:string,paymentMethod:string)=>{
    if(!name||Number(amount)<=0)return;
    const date=new Date().toISOString().slice(0,10),time=new Date().toLocaleTimeString();
    if(type==='Customer')await save('payments',{type,name,amount:Number(amount),credit:Number(amount),debit:0,paymentMethod,note,date,time,source:'Roznamcha',createdAt:new Date().toISOString()});
    else await save('expenses',{name,amount:Number(amount),note,date,time,source:'Roznamcha',createdAt:new Date().toISOString()});
    setShowForm(false);
  };
  return <div><PageTitle title="Roznamcha" sub="IN, OUT and Remaining. Customer payments are IN; Kharcha is OUT. Supplier Payments is a separate register."/>
    <div className="panel"><div className="panel-head"><div><b>Cash Roznamcha</b><small>Customer receipts and daily expenses only</small></div><button className="primary" onClick={()=>setShowForm(v=>!v)}><Plus size={18}/>{showForm?' Close':' New Entry'}</button></div>
    {showForm&&<CashEntryForm onSave={submit}/>}
    <div className="quick-grid"><div className="metric"><span>IN</span><strong className="credit-text">PKR {ins.toLocaleString()}</strong></div><div className="metric"><span>OUT</span><strong className="debit-text">PKR {outs.toLocaleString()}</strong></div><div className="metric"><span>Remaining</span><strong>PKR {(ins-outs).toLocaleString()}</strong></div></div>
    <div className="grid-2"><Ledger title="IN" rows={payments.filter((p:any)=>p.type==='Customer')} mode="in"/><Ledger title="OUT" rows={expenses} mode="out"/></div>
    </div>
  </div>;
}
function CashEntryForm({onSave}:any){
  const [kind,setKind]=useState('Customer Payment'),[name,setName]=useState(''),[amount,setAmount]=useState(''),[paymentMethod,setPaymentMethod]=useState('Cash'),[note,setNote]=useState('');
  const isCustomer=kind==='Customer Payment';
  return <div className="form-panel"><div className="form-grid"><Select label="Entry type" value={kind} options={['Customer Payment','Kharcha']} onChange={setKind}/><Input label={isCustomer?'Customer name':'Kharcha name'} value={name} onChange={setName}/><Input label="Amount" type="number" value={amount} onChange={setAmount}/>{isCustomer&&<Select label="Payment method" value={paymentMethod} options={paymentMethods} onChange={setPaymentMethod}/>}<Input label="Details / Note" value={note} onChange={setNote}/><div className="calc">{isCustomer?<span className="credit-text">IN • Jamma / Customer Credit PKR {Number(amount||0).toLocaleString()}</span>:<span className="debit-text">OUT • Kharcha PKR {Number(amount||0).toLocaleString()}</span>}</div><button className="primary full" onClick={()=>onSave(isCustomer?'Customer':'Expense',name,amount,note,paymentMethod)}>Save Entry</button></div></div>;
}

function Ledger({title,rows,mode}:any){
  return <div className="panel"><div className="panel-head"><div><b>{title}</b><small>{mode==='in'?'Money received from customers':'Daily expenses only'}</small></div></div>
    {rows.length?rows.slice().reverse().map((r:any,i:number)=><div className="list-row" key={r.id||i}><div><b>{r.name}</b><small>{r.date} {r.time?'• '+r.time:''} • {r.note||r.type||'Expense'}</small></div><strong className={mode==='in'?'credit-text':'debit-text'}>PKR {Number(r.amount||0).toLocaleString()}</strong></div>):<Empty text="No transactions."/>}
  </div>;
}

function Kharcha({records,save,remove,openEdit}:any){
  const [f,setF]=useState({name:'',amount:''}),[showForm,setShowForm]=useState(false),rows=records.expenses||[],total=rows.reduce((s:number,r:any)=>s+Number(r.amount||0),0);
  const submit=async()=>{if(!f.name||Number(f.amount)<=0)return;await save('expenses',{...f,amount:Number(f.amount),date:new Date().toISOString().slice(0,10),createdAt:new Date().toISOString()});setF({name:'',amount:''});setShowForm(false);};
  return <div><PageTitle title="Kharcha" sub="Daily expenses only. Every expense is also shown in Roznamcha OUT."/>
    <div className="panel"><div className="panel-head"><div><b>Daily expenses</b><small>{rows.length} records • Total PKR {total.toLocaleString()}</small></div><button className="primary" onClick={()=>setShowForm(v=>!v)}><Plus size={18}/>{showForm?' Close':' New Kharcha'}</button></div>
      {showForm&&<div className="form-panel"><div className="form-grid"><Input label="Expense name" value={f.name} onChange={v=>setF({...f,name:v})}/><Input label="Amount" type="number" value={f.amount} onChange={v=>setF({...f,amount:v})}/><button className="primary full" onClick={submit}>Add expense</button></div></div>}
      {rows.map((r:any)=><div className="list-row" key={r.id}><div><b>{r.name}</b><small>{r.date}{r.note?' • '+r.note:''}</small></div><strong className="debit-text">OUT PKR {Number(r.amount||0).toLocaleString()}</strong><RecordActions onEdit={()=>openEdit('expenses',r)} onDelete={()=>remove('expenses',r.id)}/></div>)}
    </div>
  </div>;
}

function Kata({title,table,records,save,remove,openEdit,openAccount}:any){
  const [showForm,setShowForm]=useState(false),[showPayment,setShowPayment]=useState(false),rows=records[table]||[],grouped=groupByName(rows);
  const isSupplier=table==='suppliers';
  const supplierNames=[...new Map(rows.map((r:any)=>{const n=String(r.name||'').trim();return [n.toLowerCase(),n] as const;}).filter((x:any)=>x[0])).values()];
  const [pf,setPf]=useState({name:'',amount:'',paymentMethod:'Cash',note:''});
  const saveSupplierPayment=async()=>{if(!isSupplier||!pf.name||Number(pf.amount)<=0)return;await save('payments',{type:'Supplier',name:pf.name,amount:Number(pf.amount),credit:0,debit:Number(pf.amount),paymentMethod:pf.paymentMethod,note:pf.note,date:new Date().toISOString().slice(0,10),time:new Date().toLocaleTimeString(),createdAt:new Date().toISOString(),source:'Supplier Kata'});setPf({name:'',amount:'',paymentMethod:'Cash',note:''});setShowPayment(false);};
  return <div><PageTitle title={title} sub="Each customer/supplier is one clickable account with dated transactions and running balance."/>
    <div className="panel"><div className="panel-head"><div><b>{title}</b><small>{grouped.items.length} accounts</small></div><div className="button-row"><button className="primary" onClick={()=>setShowForm(v=>!v)}><Plus size={18}/>{showForm?' Close':' New '+(table==='customers'?'Customer':'Supplier')}</button>{isSupplier&&<button className="secondary" onClick={()=>setShowPayment(v=>!v)}><CreditCard size={18}/>{showPayment?' Close':' Record Supplier Payment'}</button>}</div></div>
      {showForm&&<div className="form-panel"><KataAdder table={table} records={records} save={async(...args:any[])=>{await save(...args);setShowForm(false);}}/></div>}
      {showPayment&&isSupplier&&<div className="form-panel"><div className="form-grid"><Select label="Supplier" value={pf.name} options={supplierNames} onChange={v=>setPf({...pf,name:v})}/><Input label="Amount" type="number" value={pf.amount} onChange={v=>setPf({...pf,amount:v})}/><Select label="Payment method" value={pf.paymentMethod} options={paymentMethods} onChange={v=>setPf({...pf,paymentMethod:v})}/><Input label="Details / Note" value={pf.note} onChange={v=>setPf({...pf,note:v})}/><div className="calc"><span className="debit-text">Banam / Debit: PKR {Number(pf.amount||0).toLocaleString()}</span></div><button className="primary full" onClick={saveSupplierPayment}><CreditCard size={18}/> Save Supplier Payment</button></div></div>}
    </div>
    <div className="customer-grid">{grouped.items.map((r:any)=><AccountCard key={r.key} row={r} table={table} records={records} onOpen={()=>openAccount(r.name)} onEdit={()=>openEdit(table,r.source)} onDelete={()=>remove(table,r.source.id)}/>)}</div>
  </div>;
}

function KataAdder({table,records,save}:any){
  const [name,setName]=useState('');

  const existingNames = [
    ...new Set(
      (table === 'customers' ? records.customers || [] : records.suppliers || [])
        .map((r:any)=>String(r.name || '').trim())
        .filter(Boolean)
    )
  ];

  const normalizedName = name.trim().toLowerCase();

  const existingName = existingNames.find(
    (n:string)=>n.toLowerCase() === normalizedName
  );

  const suggestions = name.trim()
    ? existingNames.filter(
        (n:string)=>
          n.toLowerCase().includes(normalizedName) &&
          n.toLowerCase() !== normalizedName
      ).slice(0,5)
    : [];

  const label = table === 'customers' ? 'Customer name' : 'Supplier name';
  const existsText = table === 'customers'
    ? 'Customer exists'
    : 'Supplier exists';

  const add = async()=>{
    const cleanName = name.trim();

    if(!cleanName || existingName){
      return;
    }

    await save(table,{
      name:cleanName,
      credit:0,
      debit:0,
      createdAt:new Date().toISOString()
    });

    setName('');
  };

  return (
    <div className="kata-adder">

      <div className="form-grid">

        <div className="kata-name-field">

          <Input
            label={label}
            value={name}
            onChange={setName}
          />

          {existingName && (
            <div className="kata-exists">
              ✓ {existsText}
            </div>
          )}

          {!existingName && suggestions.length > 0 && (
            <div className="kata-suggestions">

              {suggestions.map((suggestion:string)=>(
                <button
                  type="button"
                  key={suggestion}
                  onClick={()=>setName(suggestion)}
                >
                  {suggestion}
                </button>
              ))}

            </div>
          )}

        </div>

        <button
          className="primary"
          onClick={add}
          disabled={!name.trim() || !!existingName}
        >
          <Plus size={18}/>
          Add {table === 'customers' ? 'Customer' : 'Supplier'}
        </button>

      </div>

    </div>
  );
}
function AccountCard({row,table,records,onOpen,onEdit,onDelete}:any){
  const totals=accountTotals(table,row.name,records);

  const balanceClass=
    totals.balance>0
      ? 'balance-positive'
      : totals.balance<0
        ? 'balance-negative'
        : '';

  const invs=records.invoices||[];
  const pays=records.payments||[];
  const purchases=records.purchases||[];

  const transactions:any[]=[];

  if(table==='customers'){
    invs
      .filter((r:any)=>same(r.customer,row.name))
      .forEach((r:any)=>{
        transactions.push({
          sort:r.createdAt||r.date||'',
          date:r.date,
          time:r.time,
          label:'Banam • Invoice',
          amount:Number(r.total||0)
        });
      });

    pays
      .filter((r:any)=>r.type==='Customer'&&same(r.name,row.name))
      .forEach((r:any)=>{
        transactions.push({
          sort:r.createdAt||r.date||'',
          date:r.date,
          time:r.time,
          label:'Jamma • Payment',
          amount:Number(r.amount||0)
        });
      });
  }else{
    purchases
      .filter((r:any)=>same(r.supplier,row.name))
      .forEach((r:any)=>{
        transactions.push({
          sort:r.createdAt||r.date||'',
          date:r.date,
          time:r.time,
          label:'Jamma • Purchase',
          amount:Number(r.total||0)
        });
      });

    pays
      .filter((r:any)=>r.type==='Supplier'&&same(r.name,row.name))
      .forEach((r:any)=>{
        transactions.push({
          sort:r.createdAt||r.date||'',
          date:r.date,
          time:r.time,
          label:'Banam • Payment',
          amount:Number(r.amount||0)
        });
      });
  }

  transactions.sort(
    (a,b)=>String(b.sort).localeCompare(String(a.sort))
  );

  const lastTransaction=transactions[0];

  return (
    <div
      className="account-card clickable"
      onClick={onOpen}
    >
      <div className="account-avatar">
        {row.name.slice(0,1).toUpperCase()}
      </div>

      <div className="account-main">

        <b>{row.name}</b>

        <small className="credit-text">
          Jamma (Credit) PKR {totals.credit.toLocaleString()}
        </small>

        <small className="debit-text">
          Banam (Debit) PKR {totals.debit.toLocaleString()}
        </small>

        <strong className={balanceClass}>
          Remaining {
            totals.balance>0
              ? '+PKR '
              : totals.balance<0
                ? '-PKR '
                : 'PKR '
          }
          {Math.abs(totals.balance).toLocaleString()}
        </strong>

        {lastTransaction ? (
          <div className="account-last-transaction">
            <span className="account-last-label">
              Last Transaction
            </span>

            <span className="account-last-title">
              {lastTransaction.label}
              {' • '}
              PKR {lastTransaction.amount.toLocaleString()}
            </span>

            <span className="account-last-date">
              {lastTransaction.date}
              {lastTransaction.time
                ? ' • '+lastTransaction.time
                : ''}
            </span>
          </div>
        ) : (
          <div className="account-last-transaction">
            <span className="account-last-label">
              Last Transaction
            </span>

            <span className="account-last-date">
              No transactions yet
            </span>
          </div>
        )}

      </div>

      <div
        className="record-actions"
        onClick={e=>e.stopPropagation()}
      >
        <button
          className="edit-btn"
          onClick={onEdit}
        >
          <Edit3 size={15}/>
        </button>

        <button
          className="danger-icon"
          onClick={onDelete}
        >
          <Trash2 size={16}/>
        </button>
      </div>
    </div>
  );
}
function AccountDetail({type,name,records,onBack}:any){
  const customer=type==='customer', invs=records.invoices||[], pays=records.payments||[], purchases=records.purchases||[];
  const rows:any[]=[];
  if(customer){
    invs.filter((r:any)=>same(r.customer,name)).forEach((r:any)=>rows.push({date:r.date,time:r.time,sort:r.createdAt||r.date,type:'invoice',title:r.invoiceNumber||'Invoice',detail:r.article+' • '+r.cartons+' '+r.cartonType+' • '+r.pairs+' pairs',credit:0,debit:Number(r.total||0)}));
    pays.filter((r:any)=>r.type==='Customer'&&same(r.name,name)).forEach((r:any)=>rows.push({date:r.date,time:r.time,sort:r.createdAt||r.date,type:'payment',title:'Customer Payment',detail:(r.paymentMethod||'Cash')+' • '+(r.note||'Payment received'),credit:Number(r.amount||0),debit:0}));
  }else{
    purchases.filter((r:any)=>same(r.supplier,name)).forEach((r:any)=>rows.push({date:r.date,time:r.time,sort:r.createdAt||r.date,type:'purchase',title:'Purchase',detail:r.name+' • '+(r.article||'')+' • '+(r.pairs||r.quantity)+' pairs',credit:Number(r.total||0),debit:0}));
    pays.filter((r:any)=>r.type==='Supplier'&&same(r.name,name)).forEach((r:any)=>rows.push({date:r.date,time:r.time,sort:r.createdAt||r.date,type:'payment',title:'Supplier Payment',detail:(r.paymentMethod||'Cash')+' • '+(r.note||'Payment to supplier'),credit:0,debit:Number(r.amount||0)}));
  }
  rows.sort((a,b)=>String(a.sort).localeCompare(String(b.sort)));
  let running=0;const totals=rows.reduce((a,r)=>({credit:a.credit+r.credit,debit:a.debit+r.debit}),{credit:0,debit:0});
  const totalBalance=totals.credit-totals.debit;const totalClass=totalBalance>0?'balance-positive':totalBalance<0?'balance-negative':'';
  return <div><button className="back-btn" onClick={onBack}><ChevronLeft size={18}/> Back to {customer?'Customers':'Suppliers'}</button><PageTitle title={name+' Kata'} sub={customer?'Customer: Banam (Invoice/Debit) • Jamma (Payment/Credit)':'Supplier: Jamma (Purchase/Credit) • Banam (Payment/Debit)'}/>
    <div className="quick-grid"><div className="metric"><span>Total Credit</span><strong className="credit-text">PKR {totals.credit.toLocaleString()}</strong></div><div className="metric"><span>Total Debit</span><strong className="debit-text">PKR {totals.debit.toLocaleString()}</strong></div><div className="metric"><span>Remaining</span><strong className={totalClass}>{totalBalance>0?'+PKR ':totalBalance<0?'-PKR ':'PKR '}{Math.abs(totalBalance).toLocaleString()}</strong></div></div>
    <div className="panel"><div className="panel-head"><div><b>Account Ledger</b><small>Each invoice/payment is a separate dated line.</small></div></div>
      {rows.length?rows.map((r:any,i:number)=>{running+=r.credit-r.debit;const rowClass=running>0?'balance-positive':running<0?'balance-negative':'';return <div className="ledger-detail" key={i}><div className="ledger-top"><b>{r.title}</b><span>{r.date}{r.time?' • '+r.time:''}</span></div><div className="ledger-middle">{r.detail}</div><div className="ledger-bottom">{r.credit>0?<span className="credit-text">Jamma (Credit) PKR {r.credit.toLocaleString()}</span>:<span className="debit-text">Banam (Debit) PKR {r.debit.toLocaleString()}</span>}<strong className={rowClass}>Remaining {running>0?'+PKR ':running<0?'-PKR ':'PKR '}{Math.abs(running).toLocaleString()}</strong></div></div>;}):<Empty text="No account transactions found."/>}
    </div>
  </div>;
}

function SupplierPayments({records,remove,openEdit}:any){
  const rows=(records.payments||[]).filter((r:any)=>r.type==='Supplier');
  const total=rows.reduce((s:number,r:any)=>s+Number(r.amount||0),0);
  return <div><PageTitle title="Supplier Payments" sub="Separate supplier payment register. These records do not create or appear in Roznamcha."/>
    <div className="quick-grid"><div className="metric"><span>Total Payments</span><strong className="debit-text">PKR {total.toLocaleString()}</strong></div><div className="metric"><span>Payment Records</span><strong>{rows.length}</strong></div></div>
    <div className="panel"><div className="panel-head"><div><b>Supplier Payment Register</b><small>Payments recorded from Supplier Kata</small></div></div><div className="table-wrap"><table><thead><tr><th>Supplier</th><th>Amount</th><th>Method</th><th>Date</th><th>Time</th><th>Details</th><th>Actions</th></tr></thead><tbody>{rows.slice().reverse().map((r:any)=><tr key={r.id}><td><b>{r.name||'—'}</b></td><td><span className="debit-text">PKR {Number(r.amount||0).toLocaleString()}</span></td><td>{r.paymentMethod||'—'}</td><td>{r.date||'—'}</td><td>{r.time||'—'}</td><td>{r.note||'—'}</td><td><RecordActions onEdit={()=>openEdit('payments',r)} onDelete={()=>remove('payments',r.id)}/></td></tr>)}</tbody></table>{!rows.length&&<Empty text="No supplier payments recorded."/>}</div></div>
  </div>;
}

function Reports({records}:any){
  const rows=[['Raw Stock',records.rawStock||[]],['Ready Shoes',records.readyShoes||[]],['Production',records.production||[]],['Purchases',records.purchases||[]],['Sales',records.sales||[]],['Invoices',records.invoices||[]],['Customers',records.customers||[]],['Suppliers',records.suppliers||[]],['Payments',records.payments||[]],['Kharcha',records.expenses||[]]];
  return <div><PageTitle title="Reports" sub="Reports from each ERP menu."/><div className="report-grid">{rows.map(([n,r]:any)=><div className="report-card" key={n}><BarChart3 size={20}/><b>{n}</b><strong>{r.length}</strong><small>Records available</small></div>)}</div></div>;
}
function SettingsPage(){
  const [companyName,setCompanyName]=useState(
    localStorage.getItem('hiker_company_name') || 'HIKER SHOES'
  );

  const [currency,setCurrency]=useState(
    localStorage.getItem('hiker_currency') || 'PKR'
  );

  const [cartonUnits,setCartonUnits]=useState(
    localStorage.getItem('hiker_carton_units') || '12 / 18 / 24 pairs'
  );

  const [upperBags,setUpperBags]=useState(
    localStorage.getItem('hiker_upper_bags') || '100 / 150 pairs'
  );

  const rawStockCategories,setRawStockCategories]=useState(
    localStorage.getItem('hiker_raw_stock_categories') ||
    'Uppers / Chemical / Manual'
  );

  const [pin,setPin]=useState(
    localStorage.getItem('hiker_pin') || '1234'
  );

  const [saved,setSaved]=useState('');

  const saveSetting=(key:string,value:string)=>{
    localStorage.setItem(key,value);
    setSaved(key);

    setTimeout(()=>{
      setSaved('');
    },2000);
  };
  
const savePin = () => {
  const cleanPin = pin.trim();

  if (!/^\d{4,8}$/.test(cleanPin)) {
    setSaved('pin-error');

    setTimeout(() => {
      setSaved('');
    }, 2500);

    return;
  }

  localStorage.setItem('hiker_pin', cleanPin);
  setPin(cleanPin);
  setSaved('pin');

  setTimeout(() => {
    setSaved('');
  }, 2000);
};

return (
  <div>
    <PageTitle
      title="Settings"
      sub="HIKER+ system preferences and security."
    />
      <div className="panel settings-list">

        <div className="list-row">
          <span>Company name</span>

          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input
              value={companyName}
              onChange={e=>setCompanyName(e.target.value)}
            />

            <button
              className="secondary"
              onClick={()=>
                saveSetting(
                  'hiker_company_name',
                  companyName
                )
              }
            >
              Save
            </button>
          </div>
        </div>

        {saved==='hiker_company_name'&&(
          <div className="calc">
            Company name saved successfully.
          </div>
        )}

      </div>

      <div className="panel">

        <div className="panel-head">

          <div>
            <b>App PIN</b>

            <small>
              Change the PIN required before opening the ERP.
            </small>
          </div>

          <Lock size={20}/>

        </div>

        <div className="form-grid">

          <Input
            label="New PIN (4–8 digits)"
            type="password"
            value={pin}
            onChange={setPin}
          />

          <button
            className="primary"
            onClick={savePin}
          >
            Save PIN
          </button>

          {saved==='pin'&&(
  <div className="calc">
    PIN changed successfully.
  </div>
)}

{saved==='pin-error'&&(
  <div className="pin-error">
    PIN must contain 4–8 digits.
  </div>
)}
        </div>

      </div>

    </div>
  );
}
function Recycle({records,load,setNotice}:any){
  const rows = records.recycle || [];

  const restore = async (id:string) => {
    try {
      const {
        data: { user: supabaseUser },
        error: userError
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!supabaseUser) throw new Error('No signed-in user.');

      const recycleRow = rows.find((r:any) => String(r.id) === String(id));

      if (!recycleRow) {
        throw new Error('Recycle record not found.');
      }

      const originalTable = recycleRow.originalTable;
      const originalRecord = recycleRow.record || recycleRow.originalRecord;

      if (!originalTable || !originalRecord) {
        throw new Error('Original record data is missing.');
      }

      const { error: restoreError } = await supabase
        .from('erp_records')
        .insert({
          user_id: supabaseUser.id,
          table_name: originalTable,
          data: originalRecord
        });

      if (restoreError) throw restoreError;

      const { error: deleteError } = await supabase
        .from('erp_records')
        .delete()
        .eq('id', id)
        .eq('user_id', supabaseUser.id);

      if (deleteError) throw deleteError;

      await load();
      setNotice('Record restored successfully.');
    } catch (e:any) {
      console.error('RESTORE ERROR:', e);
      setNotice('Restore failed: ' + (e?.message || 'Unknown error.'));
    }
  };

  const purge = async (id:string) => {
    if (!confirm('Permanently delete this record? This cannot be undone.')) {
      return;
    }

    try {
      const {
        data: { user: supabaseUser },
        error: userError
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!supabaseUser) throw new Error('No signed-in user.');

      const { error } = await supabase
        .from('erp_records')
        .delete()
        .eq('id', id)
        .eq('user_id', supabaseUser.id);

      if (error) throw error;

      await load();
      setNotice('Record permanently deleted.');
    } catch (e:any) {
      console.error('PURGE ERROR:', e);
      setNotice('Permanent delete failed: ' + (e?.message || 'Unknown error.'));
    }
  };

  return (
    <div>
      <PageTitle
        title="Recycle Bin"
        sub="Deleted records are kept here first. Restore returns them to their original menu."
      />

      <div className="panel">
        {rows.length ? (
          rows.map((r:any) => (
            <div className="recycle-row" key={r.id}>

  <div className="recycle-record-content">

    {(() => {
      const record = r.originalRecord || r.record || {};

      const recordName =
        record.name ||
        record.invoiceNumber ||
        record.article ||
        record.customer ||
        record.supplier ||
        r.originalTable ||
        'Deleted Record';

      return (
        <>
          <b className="recycle-record-name">
            {recordName}
          </b>

          <small className="recycle-record-meta">
            {r.originalTable} • deleted {r.deletedAt}
          </small>

          <div className="recycle-record-details">
            {Object.entries(record).map(
              ([key, value]: any) => (
                <div
                  className="recycle-detail"
                  key={key}
                >
                  <span className="recycle-detail-key">
                    {key}
                  </span>

                  <span className="recycle-detail-value">
                    {typeof value === 'object' &&
                     value !== null
                      ? JSON.stringify(value)
                      : String(value ?? '')}
                  </span>
                </div>
              )
            )}
          </div>
        </>
      );
    })()}

  </div>

  <div className="recycle-actions">

    <button
      className="restore"
      onClick={() => restore(r.id)}
    >
      <RotateCcw size={16}/>
      Restore
    </button>

    <button
      className="danger"
      onClick={() => purge(r.id)}
    >
      <Trash2 size={16}/>
      Delete
    </button>

  </div>

</div>
          ))
        ) : (
          <Empty text="Recycle Bin is empty."/>
        )}
      </div>
    </div>
  );
}
function DatabasePage({records,setNotice}:any){
  const tables=Object.entries(records).map(([name,rows])=>({name,count:(rows as any[]).length}));
  const backup=()=>{const payload={app:'HIKER+ Factory ERP',exportedAt:new Date().toISOString(),tables:records};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='HIKER_ERP_DATABASE_BACKUP_'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);setNotice('Database backup downloaded.');};
  return <div><PageTitle title="Database & Backup" sub="Online database status, record counts and one-click JSON backup."/><div className="quick-grid"><div className="metric"><span>Database</span><strong className="balance-positive">ONLINE</strong></div><div className="metric"><span>Tables</span><strong>{tables.length}</strong></div><div className="metric"><span>Total loaded records</span><strong>{tables.reduce((s,t)=>s+t.count,0).toLocaleString()}</strong></div></div><div className="panel"><div className="panel-head"><div><b>Database Tables</b><small>Current online records loaded from the ERP database.</small></div><button className="primary" onClick={backup}><Download size={18}/> Backup Database</button></div><div className="table-wrap"><table><thead><tr><th>Table</th><th>Records</th></tr></thead><tbody>{tables.map(t=><tr key={t.name}><td><b>{t.name}</b></td><td>{t.count.toLocaleString()}</td></tr>)}</tbody></table></div></div><div className="panel"><div className="panel-head"><div><b>Backup format</b><small>JSON contains the current ERP data for restore/reference.</small></div><Database size={20}/></div><button className="primary full" onClick={backup}><Download size={18}/> Download Full HIKER ERP Backup</button></div></div>;
}

function SimpleTable({title,table,rows,remove,openEdit}:any){
  const payments=table==='payments';
  return <div className="panel"><div className="panel-head"><div><b>{title}</b><small>{rows.length} records</small></div></div><div className="table-wrap"><table><thead><tr>{payments?<><th>Type</th><th>Customer / Supplier</th><th>Amount</th><th>Jamma / Banam</th><th>Date</th><th>Note</th><th>Method</th></>:<><th>{table==='invoices'?'Customer':'Name'}</th><th>Article</th><th>Quantity/Pairs</th><th>Total</th><th>Date</th></>}<th>Actions</th></tr></thead><tbody>
    {rows.map((r:any)=><tr key={r.id}>{payments?<><td>{r.type}</td><td><b>{r.name||'—'}</b></td><td>PKR {Number(r.amount||0).toLocaleString()}</td><td>{r.type==='Customer'?<span className="credit-text">Jamma / Credit</span>:<span className="debit-text">Banam / Debit</span>}</td><td>{r.date||'—'}{r.time&&<small className="invoice-no">{r.time}</small>}</td><td>{r.note||'—'}</td><td>{r.paymentMethod||'—'}</td></>:<><td>{r.name||r.customer||r.supplier||'—'}{table==='invoices'&&<small className="invoice-no">{r.invoiceNumber}</small>}</td><td>{r.article||'—'}</td><td>{r.pairs??r.quantity??r.cartons??'—'}</td><td>{r.total!=null?'PKR '+Number(r.total).toLocaleString():r.amount!=null?'PKR '+Number(r.amount).toLocaleString():'—'}</td><td>{r.date||'—'}</td></>}<td><RecordActions onEdit={()=>openEdit(table,r)} onDelete={()=>remove(table,r.id)}/></td></tr>)}
  </tbody></table>{!rows.length&&<Empty text="No records found."/>}</div></div>;
}

function RecordActions({onEdit,onDelete}:any){return <div className="record-actions"><button className="edit-btn" onClick={onEdit} title="Edit"><Edit3 size={15}/></button><button className="danger-icon" onClick={onDelete} title="Move to Recycle Bin"><Trash2 size={16}/></button></div>;}

function EditModal({table,record,onClose,onSave}:any){
  const schema:Record<string,string[]>={rawStock:['name','article','category','unit','quantity','price','minStock'],readyShoes:['name','article','cartonType','cartons'],production:['article','cartonType','cartons','date'],purchases:['supplier','name','article','unit','quantity','price','date'],sales:['customer','article','cartons','pairs','total','date'],invoices:['customer','article','cartonType','cartons','price','date'],customers:['name'],suppliers:['name'],payments:['type','name','amount','paymentMethod','note','date'],expenses:['name','amount','date']};
  const fields=schema[table]||Object.keys(record).filter(k=>!['id','createdAt','updatedAt','productionId','sourcePurchase','sourceInvoice','readyId','salesId','consumedFrom','availablePairs','totalPairs','pairs','time','invoiceNumber'].includes(k));
  const [f,setF]=useState<Record<string,any>>(()=>{const x:any={};fields.forEach(k=>x[k]=record[k]??'');return x;});
  const set=(k:string,v:any)=>setF({...f,[k]:v});
  const carton=table==='readyShoes'||table==='production'||table==='invoices';
  const unit=table==='rawStock'||table==='purchases';
  const pairCalc=table==='rawStock'&&f.category==='Uppers'?(Number(f.quantity)||0)*(bagPairs[f.unit]||100):table==='readyShoes'?(Number(f.cartons)||0)*cartonPairs[f.cartonType]:table==='production'?(Number(f.cartons)||0)*cartonPairs[f.cartonType]:table==='invoices'?(Number(f.cartons)||0)*cartonPairs[f.cartonType]:null;
  return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><b>Edit {tableLabel(table)}</b><small>Changes are saved to the same record.</small></div><button onClick={onClose}><X/></button></div><div className="form-grid">
    {fields.map(k=>k==='category'?<Select key={k} label="Category" value={f[k]} options={['Uppers','Chemical','Other']} onChange={v=>set(k,v)}/>:k==='unit'&&table==='rawStock'?<Select key={k} label="Unit" value={f[k]} options={f.category==='Uppers'?['100 pairs/bag','150 pairs/bag']:['Drums','KG','Pieces','Cartons']} onChange={v=>set(k,v)}/>:k==='unit'&&table==='purchases'?<Select key={k} label="Unit" value={f[k]} options={['100 pairs/bag','150 pairs/bag','12 pairs','18 pairs','24 pairs']} onChange={v=>set(k,v)}/>:k==='cartonType'?<Select key={k} label="Carton" value={f[k]} options={Object.keys(cartonPairs)} onChange={v=>set(k,v)}/>:k==='type'?<Select key={k} label="Type" value={f[k]} options={['Customer','Supplier']} onChange={v=>set(k,v)}/>:<Input key={k} label={pretty(k)} type={['quantity','price','minStock','cartons','pairs','total','amount'].includes(k)?'number':k==='date'?'date':'text'} value={f[k]} onChange={v=>set(k,v)}/>)}
    {pairCalc!==null&&<div className="calc">Auto pairs: <b>{Number(pairCalc).toLocaleString()}</b></div>}
  </div><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={()=>{const next={...record,...f};if(table==='rawStock'&&f.category==='Uppers'){next.totalPairs=pairCalc;next.availablePairs=pairCalc;}if(table==='readyShoes'){next.totalPairs=pairCalc;next.availablePairs=Math.min(Number(record.availablePairs??record.totalPairs??0),pairCalc);}if(table==='invoices'){next.pairs=pairCalc;next.total=pairCalc*(Number(f.price)||0);}if(table==='production'){next.outputPairs=pairCalc;}onSave(next);}}>Save changes</button></div></div></div>;
}

function PageTitle({title,sub,action}:any){return <div className="page-head"><div><h2>{title}</h2><p>{sub}</p></div>{action}</div>;}
function Empty({text}:any){return <div className="empty"><Package size={25}/><span>{text}</span></div>;}
function Input({label,value,onChange,type='text'}:any){return <label className="field"><span>{label}</span><input type={type} value={value} onChange={e=>onChange(e.target.value)}/></label>;}
function Select({label,value,options,onChange}:any){return <label className="field"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{options.length?options.map((o:string)=><option key={o}>{o}</option>):<option value="">No options</option>}</select></label>;}
function pretty(k:string){return k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase());}
function tableLabel(t:string){return t.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase());}
function same(a:string,b:string){return String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();}
function uniqueNames(rows:any[]){return [...new Set(rows.map(r=>String(r.name||'').trim().toLowerCase()).filter(Boolean))];}
function groupByName(rows:any[]){const m=new Map<string,any>();rows.forEach(r=>{const key=String(r.name||'').trim().toLowerCase();if(!key)return;if(!m.has(key))m.set(key,{key,name:r.name,source:r});});return {items:[...m.values()]};}
function accountTotals(table:string,name:string,records:any[]){if(table==='customers'){const debit=(records.invoices||[]).filter((r:any)=>same(r.customer,name)).reduce((s:number,r:any)=>s+Number(r.total||0),0);const credit=(records.payments||[]).filter((r:any)=>r.type==='Customer'&&same(r.name,name)).reduce((s:number,r:any)=>s+Number(r.amount||0),0);return {credit,debit,balance:credit-debit};}const credit=(records.purchases||[]).filter((r:any)=>same(r.supplier,name)).reduce((s:number,r:any)=>s+Number(r.total||0),0);const debit=(records.payments||[]).filter((r:any)=>r.type==='Supplier'&&same(r.name,name)).reduce((s:number,r:any)=>s+Number(r.amount||0),0);return {credit,debit,balance:credit-debit};}
function lastDays(n:number){const out:string[]=[];for(let i=n-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);out.push(d.toISOString().slice(0,10));}return out;}



                                                                                                                                                                                                                                                                                                                                                
export default App;
