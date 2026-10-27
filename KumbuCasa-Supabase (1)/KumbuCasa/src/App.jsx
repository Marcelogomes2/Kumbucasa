import { useEffect, useMemo, useState } from 'react'
import { Search, MapPin, BedDouble, Bath, Maximize2, Heart, Menu, X, ArrowRight, House, KeyRound, Plus, LogOut, UserRound, SlidersHorizontal, MessageCircle, LoaderCircle, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase, isSupabaseConfigured } from './lib/supabase'

const samplePhotos = {
  casa: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1000&q=80',
  apartamento: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=80',
  terreno: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80',
  vivenda: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1000&q=80',
  comercial: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=80',
  quarto: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1000&q=80',
}
const types = ['Todos os tipos', 'casa', 'vivenda', 'apartamento', 'terreno', 'quarto', 'comercial']
const money = (price, currency = 'AOA') => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(Number(price || 0)) + (currency === 'USD' ? ' USD' : ' Kz')
const typeName = (t) => ({ casa: 'Casa', vivenda: 'Vivenda', apartamento: 'Apartamento', terreno: 'Terreno', quarto: 'Quarto', comercial: 'Comercial', outro: 'Outro' }[t] || t || 'Imóvel')

function App() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState('')
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('Todos os tipos')
  const [listing, setListing] = useState('Todos')
  const [favorites, setFavorites] = useState([])
  const [showAuth, setShowAuth] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [notice, setNotice] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [authBusy, setAuthBusy] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) { setConnectionError('Configure as variáveis do Supabase no ficheiro .env.local.'); setLoading(false); return }
    loadProperties()
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session?.user) loadProfile(session.user.id); else { setProfile(null); setFavorites([]) } }, [session])
  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('full_name,phone,role').eq('id', userId).maybeSingle()
    setProfile(data || null)
    const { data: favs } = await supabase.from('favorites').select('property_id').eq('user_id', userId)
    setFavorites((favs || []).map(x => x.property_id))
  }
  async function loadProperties() {
    setLoading(true); setConnectionError('')
    const { data, error } = await supabase.from('properties').select('*, property_images(image_url,display_order)').eq('status', 'published').order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(60)
    if (error) setConnectionError(error.message)
    setProperties((data || []).map(p => ({ ...p, photo: (p.property_images || []).sort((a,b) => a.display_order-b.display_order)[0]?.image_url || samplePhotos[p.property_type] || samplePhotos.casa })))
    setLoading(false)
  }
  const filtered = useMemo(() => properties.filter(p => {
    const q = search.trim().toLocaleLowerCase('pt')
    const text = [p.title, p.description, p.province, p.municipality, p.address, p.property_type].filter(Boolean).join(' ').toLocaleLowerCase('pt')
    return (!q || text.includes(q)) && (type === 'Todos os tipos' || p.property_type === type) && (listing === 'Todos' || p.listing_type === listing.toLowerCase())
  }), [properties, search, type, listing])

  async function submitAuth(e) {
    e.preventDefault(); setAuthBusy(true); setNotice('')
    const fd = new FormData(e.currentTarget); const email = fd.get('email'); const password = fd.get('password'); const name = fd.get('name')
    let result
    if (authMode === 'signup') result = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
    else result = await supabase.auth.signInWithPassword({ email, password })
    setAuthBusy(false)
    if (result.error) setNotice(result.error.message)
    else { setNotice(authMode === 'signup' ? 'Conta criada. Se for pedido, confirme o email para entrar.' : 'Sessão iniciada.'); if (authMode === 'login' || result.data.session) setShowAuth(false) }
  }
  async function toggleFavorite(id) {
    if (!session) { setShowAuth(true); setNotice('Entre na sua conta para guardar favoritos.'); return }
    if (favorites.includes(id)) {
      const { error } = await supabase.from('favorites').delete().eq('user_id', session.user.id).eq('property_id', id)
      if (!error) setFavorites(prev => prev.filter(x => x !== id)); else setNotice(error.message)
    } else {
      const { error } = await supabase.from('favorites').insert({ user_id: session.user.id, property_id: id })
      if (!error) setFavorites(prev => [...prev, id]); else setNotice(error.message)
    }
  }
  async function publishProperty(e) {
    e.preventDefault(); if (!session) return setShowAuth(true)
    const fd = new FormData(e.currentTarget)
    const row = { owner_id: session.user.id, title: fd.get('title'), description: fd.get('description'), property_type: fd.get('property_type'), listing_type: fd.get('listing_type'), price: Number(fd.get('price')), currency: fd.get('currency'), province: fd.get('province'), municipality: fd.get('municipality') || null, address: fd.get('address') || null, bedrooms: fd.get('bedrooms') ? Number(fd.get('bedrooms')) : null, bathrooms: fd.get('bathrooms') ? Number(fd.get('bathrooms')) : null, area_m2: fd.get('area_m2') ? Number(fd.get('area_m2')) : null, status: 'published' }
    const { error } = await supabase.from('properties').insert(row)
    if (error) setNotice('Não foi possível publicar: ' + error.message)
    else { setNotice('Anúncio enviado com sucesso!'); setShowPublish(false); await loadProperties() }
  }
  const openPublish = () => { if (!session) { setShowAuth(true); setNotice('Inicie sessão para publicar um imóvel.'); return } setShowPublish(true) }
  const whatsapp = (p) => `https://wa.me/?text=${encodeURIComponent(`Olá! Encontrei o anúncio "${p.title}" na KumbuCasa (${p.id}) e gostaria de obter mais informações sobre este imóvel.`)}`

  return <div className="app-shell">
    <header className="topbar"><a href="#inicio" className="brand"><span className="brand-icon"><House size={23}/></span><span>Kumbu<span className="brand-light">Casa</span><small>O seu próximo lar começa aqui</small></span></a>
      <nav className={mobileMenu ? 'nav nav-open' : 'nav'}><a href="#imoveis" onClick={() => setMobileMenu(false)}>Encontrar imóvel</a><a href="#como-funciona" onClick={() => setMobileMenu(false)}>Como funciona</a><button className="nav-publish" onClick={openPublish}><Plus size={17}/> Publicar anúncio</button></nav>
      <div className="header-actions">{session ? <><button className="account-button" onClick={() => setNotice(`Sessão iniciada como ${session.user.email}`)}><UserRound size={18}/><span>{profile?.full_name || session.user.email?.split('@')[0]}</span></button><button className="icon-button" aria-label="Terminar sessão" onClick={() => supabase.auth.signOut()}><LogOut size={18}/></button></> : <button className="login-button" onClick={() => {setShowAuth(true);setAuthMode('login')}}>Entrar <ArrowRight size={16}/></button>}<button className="menu-button" aria-label="Abrir menu" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X/> : <Menu/>}</button></div>
    </header>

    <main>
      <section className="hero" id="inicio"><div className="hero-overlay"></div><div className="hero-content"><div className="eyebrow"><span></span> IMÓVEIS EM ANGOLA</div><h1>O lugar certo para<br/><em>começar a sua história.</em></h1><p>Encontre casas, apartamentos e terrenos para comprar ou arrendar. A sua próxima oportunidade está mais perto.</p>
        <div className="search-panel"><div className="search-field"><Search size={21}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Província, município ou palavra-chave" aria-label="Pesquisar imóveis"/></div><div className="search-select"><label>Tipo de negócio</label><select value={listing} onChange={e=>setListing(e.target.value)}><option>Todos</option><option>Venda</option><option>Arrendamento</option></select></div><div className="search-select"><label>Tipo de imóvel</label><select value={type} onChange={e=>setType(e.target.value)}>{types.map(t=><option key={t} value={t}>{t === 'Todos os tipos' ? t : typeName(t)}</option>)}</select></div><button className="search-button" onClick={()=>document.getElementById('imoveis').scrollIntoView({behavior:'smooth'})}><Search size={18}/> Pesquisar</button></div>
        <div className="hero-trust"><span><CheckCircle2 size={16}/> Anúncios num só lugar</span><span><MapPin size={16}/> Luanda e outras províncias</span></div></div><div className="hero-stamp"><span>O SEU LAR</span><strong>começa aqui.</strong><div>⌂</div></div></section>

      <section className="stats-strip"><div><strong>{properties.length.toLocaleString('pt-PT')}+</strong><span>imóveis publicados</span></div><i></i><div><strong>18</strong><span>províncias de Angola</span></div><i></i><div><strong>24/7</strong><span>pesquisa online</span></div><div className="stats-note">A sua casa, os seus planos, o seu futuro.</div></section>

      <section className="listings-section" id="imoveis"><div className="section-heading"><div><div className="eyebrow dark"><span></span> ESCOLHA O SEU PRÓXIMO PASSO</div><h2>Imóveis em destaque<span>.</span></h2><p>Descubra oportunidades que combinam com o seu estilo de vida.</p></div><button className="outline-button" onClick={openPublish}><Plus size={17}/> Anunciar imóvel</button></div>
        {connectionError && <div className="notice error"><AlertCircle size={18}/><span>{connectionError}<br/><small>Confirme a ligação e as permissões das tabelas no Supabase.</small></span></div>}
        <div className="filter-row"><span><SlidersHorizontal size={17}/> {filtered.length} resultado(s)</span><div className="quick-filters"><button className={listing==='Todos'?'active':''} onClick={()=>setListing('Todos')}>Todos</button><button className={listing==='Venda'?'active':''} onClick={()=>setListing('Venda')}>Comprar</button><button className={listing==='Arrendamento'?'active':''} onClick={()=>setListing('Arrendamento')}>Arrendar</button></div></div>
        {loading ? <div className="loading-state"><LoaderCircle className="spin" size={30}/><p>A procurar imóveis...</p></div> : filtered.length ? <div className="property-grid">{filtered.map(p=><article className="property-card" key={p.id}><div className="property-photo"><img src={p.photo} alt={p.title} loading="lazy" onError={e=>{e.currentTarget.src=samplePhotos.casa}}/><span className="listing-badge">{p.listing_type==='arrendamento'?'Arrendamento':'Venda'}</span>{p.is_featured && <span className="featured-badge">Destaque</span>}<button className={favorites.includes(p.id)?'favorite favorited':'favorite'} aria-label="Guardar favorito" onClick={()=>toggleFavorite(p.id)}><Heart size={18} fill={favorites.includes(p.id)?'currentColor':'none'}/></button></div><div className="property-body"><div className="property-type">{typeName(p.property_type)}</div><h3>{p.title}</h3><div className="property-location"><MapPin size={15}/>{[p.municipality,p.province].filter(Boolean).join(', ') || 'Angola'}</div><div className="property-features">{p.bedrooms != null && <span><BedDouble size={16}/>{p.bedrooms} quartos</span>}{p.bathrooms != null && <span><Bath size={16}/>{p.bathrooms} WC</span>}{p.area_m2 != null && <span><Maximize2 size={15}/>{p.area_m2} m²</span>}</div><div className="property-footer"><strong>{money(p.price,p.currency)}</strong><a href={whatsapp(p)} target="_blank" rel="noreferrer" className="whatsapp-link" aria-label="Contactar no WhatsApp"><MessageCircle size={17}/></a></div></div></article>)}</div> : <div className="empty-state"><div className="empty-icon"><House size={30}/></div><h3>{properties.length ? 'Não encontrámos resultados' : 'Os primeiros anúncios estão por chegar'}</h3><p>{properties.length ? 'Experimente alterar a pesquisa ou os filtros.' : 'Quando os imóveis forem publicados no Supabase, aparecerão aqui automaticamente. Pode ser o primeiro a anunciar.'}</p><button className="primary-button" onClick={openPublish}><Plus size={17}/> Publicar primeiro anúncio</button></div>}
      </section>

      <section className="how-section" id="como-funciona"><div className="how-copy"><div className="eyebrow"><span></span> SIMPLES E DIRETO</div><h2>Menos procura.<br/><em>Mais possibilidades.</em></h2><p>A KumbuCasa aproxima quem procura um imóvel de quem tem um para vender ou arrendar.</p><button className="light-button" onClick={openPublish}>Publique o seu imóvel <ArrowRight size={17}/></button></div><div className="how-steps"><div className="step"><span>01</span><div><h3>Pesquise</h3><p>Use a localização e os filtros para encontrar o que procura.</p></div><Search/></div><div className="step"><span>02</span><div><h3>Compare</h3><p>Veja os preços, as características e as fotografias dos imóveis.</p></div><House/></div><div className="step"><span>03</span><div><h3>Entre em contacto</h3><p>Fale diretamente com o anunciante e marque uma visita.</p></div><MessageCircle/></div></div></section>
      <section className="cta-section"><div><div className="eyebrow dark"><span></span> TEM UM IMÓVEL?</div><h2>O seu anúncio merece<br/>ser encontrado.</h2><p>Publique o seu imóvel e chegue a pessoas que procuram casa em Angola.</p></div><button className="primary-button" onClick={openPublish}>Publicar anúncio <ArrowRight size={18}/></button></section>
    </main>
    <footer><a href="#inicio" className="brand footer-brand"><span className="brand-icon"><House size={21}/></span><span>Kumbu<span className="brand-light">Casa</span><small>O seu próximo lar começa aqui</small></span></a><span>© {new Date().getFullYear()} KumbuCasa. Feito para Angola.</span><div><a href="#imoveis">Encontrar imóvel</a><a href="#como-funciona">Como funciona</a></div></footer>

    {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Fechar aviso"><X size={17}/></button></div>}
    {showAuth && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowAuth(false)}}><section className="modal"><button className="modal-close" onClick={()=>setShowAuth(false)} aria-label="Fechar"><X/></button><div className="modal-logo"><House size={23}/></div><h2>{authMode==='login'?'Bem-vindo de volta':'Crie a sua conta'}</h2><p>{authMode==='login'?'Entre para guardar favoritos e publicar imóveis.':'Junte-se à KumbuCasa e publique o seu imóvel.'}</p><form onSubmit={submitAuth}>{authMode==='signup'&&<label>Nome completo<input name="name" required minLength="2" placeholder="O seu nome"/></label>}<label>Email<input name="email" type="email" required placeholder="voce@exemplo.com"/></label><label>Palavra-passe<input name="password" type="password" required minLength="6" placeholder="Mínimo 6 caracteres"/></label><button className="primary-button full" disabled={authBusy}>{authBusy?<LoaderCircle className="spin" size={18}/>:<KeyRound size={17}/>} {authMode==='login'?'Entrar':'Criar conta'}</button></form><div className="modal-switch">{authMode==='login'?'Ainda não tem conta?':'Já tem conta?'} <button onClick={()=>setAuthMode(authMode==='login'?'signup':'login')}>{authMode==='login'?'Criar conta':'Entrar'}</button></div></section></div>}
    {showPublish && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowPublish(false)}}><section className="modal publish-modal"><button className="modal-close" onClick={()=>setShowPublish(false)} aria-label="Fechar"><X/></button><div className="modal-logo"><Plus size={23}/></div><h2>Publicar imóvel</h2><p>Preencha os dados principais. O anúncio ficará visível após ser guardado.</p><form onSubmit={publishProperty}><label>Título do anúncio<input name="title" required minLength="5" maxLength="150" placeholder="Ex.: Vivenda T3 no Talatona"/></label><label>Descrição<textarea name="description" rows="3" placeholder="Descreva o imóvel e os seus pontos fortes"/></label><div className="form-grid"><label>Tipo de imóvel<select name="property_type" required>{types.slice(1).map(t=><option key={t} value={t}>{typeName(t)}</option>)}</select></label><label>Negócio<select name="listing_type"><option value="venda">Venda</option><option value="arrendamento">Arrendamento</option></select></label><label>Preço<input name="price" type="number" min="0" required placeholder="Ex.: 45000000"/></label><label>Moeda<select name="currency"><option value="AOA">Kwanza (Kz)</option><option value="USD">Dólar (USD)</option></select></label><label>Província<input name="province" defaultValue="Luanda" required/></label><label>Município<input name="municipality" placeholder="Ex.: Talatona"/></label><label>Quartos<input name="bedrooms" type="number" min="0" placeholder="3"/></label><label>Casas de banho<input name="bathrooms" type="number" min="0" placeholder="2"/></label><label>Área (m²)<input name="area_m2" type="number" min="0" placeholder="180"/></label><label>Endereço/bairro<input name="address" placeholder="Bairro ou referência"/></label></div><button className="primary-button full"><Plus size={17}/> Publicar anúncio</button></form></section></div>}
    {!isSupabaseConfigured && <div className="setup-ribbon">Configuração necessária: edite o ficheiro .env.local e reinicie o servidor.</div>}
  </div>
}
export default App
