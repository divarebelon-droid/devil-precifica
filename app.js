'use strict';

const STORAGE_KEY = 'devil_precifica_v2';
const businesses = {
  oficina: { label: 'OFICINA DIVA REBEL', short: 'Oficina' },
  diva: { label: 'DIVA REBEL', short: 'Diva Rebel' }
};

const offerSeeds = {
  oficina: [
    { id: crypto.randomUUID(), name: 'Plano de Ação', deliverables: 'Diagnóstico, plano estratégico e direcionamento prático.', hours: 8, directCost: 0, risk: 10, premium: 20, mix: 0 },
    { id: crypto.randomUUID(), name: 'Plano de Negócios', deliverables: 'Acompanhamento recorrente, reuniões, plano e análise.', hours: 14, directCost: 0, risk: 15, premium: 25, mix: 0 },
    { id: crypto.randomUUID(), name: 'Consultoria Avulsa', deliverables: 'Sessão estratégica com análise e próximos passos.', hours: 3, directCost: 0, risk: 10, premium: 30, mix: 0 }
  ],
  diva: [
    { id: crypto.randomUUID(), name: 'Reunião Garantida', deliverables: 'Produto digital e suporte previsto na oferta.', hours: 1, directCost: 0, risk: 5, premium: 30, mix: 0 },
    { id: crypto.randomUUID(), name: 'Sistema Fecha Cliente', deliverables: 'Implementação, acompanhamento e suporte.', hours: 10, directCost: 0, risk: 15, premium: 30, mix: 0 },
    { id: crypto.randomUUID(), name: 'Consultoria para Social Media', deliverables: 'Diagnóstico e direcionamento comercial.', hours: 3, directCost: 0, risk: 10, premium: 25, mix: 0 }
  ]
};

function profileDefaults(type) {
  return {
    config: {
      prolabore: 0, replacementSalary: 0, includeReplacement: false,
      tools: 0, accounting: 0, infrastructure: 0, otherFixed: 0,
      currentTeam: 0, futureTeam: 0, taxRate: 0, profitMargin: 15,
      safetyReserve: 10, riskBuffer: 10, hoursDay: 8, daysWeek: 5,
      productivity: 70, adminShare: 25
    },
    time: { atendimento: 0, reunioes: 0, conteudo: 0, administrativo: 0 },
    splits: { invest: 30, prolabore: 30, cash: 40 },
    offers: structuredClone(offerSeeds[type]), clients: [], receipts: []
  };
}

function freshState() {
  return { activeBusiness: 'oficina', activeView: 'dashboard', profiles: { oficina: profileDefaults('oficina'), diva: profileDefaults('diva') } };
}

function loadState() {
  return freshState();
}

let state = loadState();
let saveTimer;
let cloudSaveTimer;
let googleCredential = '';
const CLOUD_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzYtXCvp-ifq2e593VdsnBquH_8a5lOCox8Y4GG0_R2XA0gkC2x0mP9-Ah3aJNlsZ7DUA/exec';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const num = value => Math.max(0, Number(value) || 0);
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(Number(value) || 0);
const wholeMoney = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(value) || 0);
const pct = value => `${(Number(value) || 0).toFixed(1).replace('.', ',')}%`;

function profile() { return state.profiles[state.activeBusiness]; }

function save() {
  const el = $('#saveState');
  if (!googleCredential) return;
  el.style.opacity = '1'; el.textContent = 'Salvando...';
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => cloudRequest('save', JSON.stringify(state)), 500);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { el.style.opacity = '.55'; }, 1800);
}

function cloudRequest(action, data = '') {
  const requestId = crypto.randomUUID();
  const form = document.createElement('form');
  form.method = 'POST'; form.action = CLOUD_ENDPOINT; form.target = 'cloudTransport'; form.style.display = 'none';
  ({ action, credential: googleCredential, requestId, data }).forEach?.(() => {});
  Object.entries({ action, credential: googleCredential, requestId, data }).forEach(([name, value]) => {
    const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; form.appendChild(input);
  });
  document.body.appendChild(form); form.submit(); form.remove();
  return requestId;
}

window.handleCredentialResponse = function(response) {
  googleCredential = response && response.credential || '';
  $('#loginError').textContent = '';
  cloudRequest('get');
};

window.addEventListener('message', event => {
  if (!String(event.origin).endsWith('.googleusercontent.com') && event.origin !== 'https://script.google.com') return;
  const result = event.data || {};
  if (!result.ok) {
    $('#loginError').textContent = result.error || 'Não foi possível acessar seus dados.';
    return;
  }
  if (result.action === 'get') {
    try {
      const loaded = result.data ? JSON.parse(result.data) : freshState();
      if (!loaded?.profiles?.oficina || !loaded?.profiles?.diva) throw new Error('Dados inválidos');
      state = loaded;
      document.body.classList.add('authenticated');
      $('#cloudStatus').textContent = 'Sincronizado com Google';
      hydrateInputs(); setBusiness(state.activeBusiness || 'oficina'); setView(state.activeView || 'dashboard'); renderAll();
    } catch {
      $('#loginError').textContent = 'Os dados salvos não puderam ser carregados.';
    }
  } else if (result.action === 'save') {
    const el = $('#saveState'); el.textContent = 'Salvo'; el.style.opacity = '.55';
    $('#cloudStatus').textContent = 'Sincronizado com Google';
  }
});

function calculate(p = profile()) {
  const c = p.config;
  const fixed = num(c.prolabore) + num(c.tools) + num(c.accounting) + num(c.infrastructure) + num(c.otherFixed) + num(c.currentTeam) + num(c.futureTeam) + (c.includeReplacement ? num(c.replacementSalary) : 0);
  const productive = num(c.hoursDay) * num(c.daysWeek) * 4.33 * (num(c.productivity) / 100);
  const adminHours = productive * (Math.min(num(c.adminShare), 95) / 100);
  const deliveryHours = Math.max(0, productive - adminHours);
  const obligations = (num(c.taxRate) + num(c.profitMargin) + num(c.safetyReserve) + num(c.riskBuffer)) / 100;
  const divisor = Math.max(.05, 1 - obligations);
  const revenue = fixed > 0 ? fixed / divisor : 0;
  const costHour = deliveryHours > 0 ? fixed / deliveryHours : 0;
  const healthyHour = deliveryHours > 0 ? revenue / deliveryHours : 0;
  const clientRevenue = p.clients.reduce((sum, item) => sum + num(item.price), 0);
  const clientHours = p.clients.reduce((sum, item) => sum + num(item.hours), 0);
  const clientDirect = p.clients.reduce((sum, item) => sum + num(item.directCost), 0);
  const clientTax = clientRevenue * num(c.taxRate) / 100;
  const portfolioProfit = clientRevenue - clientTax - clientDirect - (clientHours * costHour);
  const portfolioMargin = clientRevenue > 0 ? portfolioProfit / clientRevenue * 100 : null;
  return { fixed, productive, adminHours, deliveryHours, obligations, revenue, costHour, healthyHour, clientRevenue, clientHours, portfolioProfit, portfolioMargin };
}

function offerPrices(offer, metrics = calculate()) {
  const tax = Math.min(num(profile().config.taxRate) / 100, .9);
  const base = num(offer.hours) * metrics.costHour + num(offer.directCost);
  const floor = base > 0 ? base / Math.max(.1, 1 - tax) : 0;
  const healthy = (num(offer.hours) * metrics.healthyHour + num(offer.directCost)) * (1 + num(offer.risk) / 100);
  const strategic = healthy * (1 + num(offer.premium) / 100);
  return { floor, healthy, strategic };
}

function setView(view) {
  state.activeView = view;
  $$('.view').forEach(el => el.classList.toggle('active', el.id === `view-${view}`));
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  const active = $(`.nav-item[data-view="${view}"]`);
  $('#pageTitle').textContent = active ? active.textContent.trim().replace(/^[^\wÀ-ÿ]+/, '') : 'Visão geral';
  $('#sidebar').classList.remove('open');
  save();
}

function setBusiness(type) {
  state.activeBusiness = type;
  $$('.business-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.business === type));
  $('#businessLabel').textContent = businesses[type].label;
  hydrateInputs();
  renderAll();
  save();
}

function hydrateInputs() {
  const p = profile();
  $$('[data-field]').forEach(input => {
    const value = p.config[input.dataset.field];
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = value ?? '';
  });
  $$('[data-time]').forEach(input => input.value = p.time[input.dataset.time] ?? '');
  $$('[data-split]').forEach(input => input.value = p.splits[input.dataset.split] ?? 0);
}

function renderDashboard() {
  const p = profile(), m = calculate(p), s = p.splits;
  $('#dashPriceHour').textContent = money(m.healthyHour);
  $('#dashRevenue').textContent = wholeMoney(m.revenue);
  $('#dashCapacity').textContent = `${m.deliveryHours.toFixed(1).replace('.', ',')}h`;
  $('#dashPortfolioMargin').textContent = m.portfolioMargin === null ? '—' : pct(m.portfolioMargin);
  $('#summaryClients').textContent = p.clients.length;
  $('#summaryClientRevenue').textContent = wholeMoney(m.clientRevenue);
  $('#summaryClientHours').textContent = `${m.clientHours.toFixed(1).replace('.', ',')}h`;
  $('#summaryFreeCapacity').textContent = `${Math.max(0, m.deliveryHours - m.clientHours).toFixed(1).replace('.', ',')}h`;
  $('#legendInvest').textContent = `${num(s.invest)}%`; $('#legendProlabore').textContent = `${num(s.prolabore)}%`; $('#legendCash').textContent = `${num(s.cash)}%`;
  $('#barInvest').style.width = `${num(s.invest)}%`; $('#barProlabore').style.width = `${num(s.prolabore)}%`; $('#barCash').style.width = `${num(s.cash)}%`;

  const required = ['prolabore','tools','taxRate','hoursDay','daysWeek','productivity'];
  let score = 0;
  if (m.fixed > 0) {
    score = required.filter(k => num(p.config[k]) > 0).length * 9;
    score += Math.min(16, p.offers.filter(o => num(o.hours) > 0).length * 6);
    score += Math.min(15, p.clients.length * 5);
    score += Math.min(15, p.receipts.length * 5);
  }
  score = Math.min(100, score);
  $('#healthScore').textContent = score;
  $('#healthRing').style.background = `conic-gradient(var(--accent) ${score * 3.6}deg,#23232c 0)`;

  const decision = $('#decisionContent');
  if (m.fixed === 0) decision.innerHTML = `<span class="status-pill neutral">Comece pela estrutura</span><h4>Preencha seus custos para descobrir o preço mínimo sustentável.</h4><button class="text-btn" data-go="estrutura">Configurar estrutura →</button>`;
  else if (m.deliveryHours === 0) decision.innerHTML = `<span class="status-pill warn">Capacidade incompleta</span><h4>Defina sua rotina para calcular o valor real da sua hora.</h4><button class="text-btn" data-go="tempo">Configurar tempo →</button>`;
  else if (!p.clients.length) decision.innerHTML = `<span class="status-pill neutral">Preço calculado</span><h4>Sua hora saudável é ${money(m.healthyHour)}. Cadastre os clientes para avaliar a carteira.</h4><button class="text-btn" data-go="clientes">Cadastrar clientes →</button>`;
  else if (m.portfolioMargin < 0) decision.innerHTML = `<span class="status-pill bad">Carteira no prejuízo</span><h4>As horas e os custos cadastrados estão consumindo mais do que a carteira gera.</h4><button class="text-btn" data-go="clientes">Ver diagnóstico →</button>`;
  else if (m.clientHours > m.deliveryHours) decision.innerHTML = `<span class="status-pill warn">Capacidade excedida</span><h4>Sua carteira usa ${m.clientHours.toFixed(1)}h, acima das ${m.deliveryHours.toFixed(1)}h disponíveis.</h4><button class="text-btn" data-go="clientes">Revisar carteira →</button>`;
  else decision.innerHTML = `<span class="status-pill good">Estrutura saudável</span><h4>Sua carteira deixa ${pct(m.portfolioMargin)} de margem estimada e ainda possui ${Math.max(0,m.deliveryHours-m.clientHours).toFixed(1)}h livres.</h4><button class="text-btn" data-go="ofertas">Simular crescimento →</button>`;
}

function renderStructure() {
  const c = profile().config, m = calculate();
  $('#structuralCost').textContent = wholeMoney(m.fixed);
  $('#minimumRevenue').textContent = wholeMoney(m.revenue);
  const parts = [];
  if (num(c.taxRate)) parts.push(`${c.taxRate}% de imposto`);
  if (num(c.profitMargin)) parts.push(`${c.profitMargin}% de lucro`);
  if (num(c.safetyReserve)) parts.push(`${c.safetyReserve}% de reserva`);
  if (num(c.riskBuffer)) parts.push(`${c.riskBuffer}% de folga`);
  $('#structureExplanation').textContent = m.fixed ? `Para cobrir ${wholeMoney(m.fixed)} em custos e preservar ${parts.join(', ') || 'a operação'}, a empresa precisa faturar pelo menos ${wholeMoney(m.revenue)} por mês.` : 'Preencha os valores acima para ver a composição.';
}

function renderTime() {
  const p = profile(), m = calculate();
  $('#productiveHours').textContent = `${m.deliveryHours.toFixed(1).replace('.', ',')}h`;
  $('#deliveryHours').textContent = `${m.deliveryHours.toFixed(1).replace('.', ',')}h`;
  $('#adminHours').textContent = `${m.adminHours.toFixed(1).replace('.', ',')}h`;
  $('#deliveryTrack').style.width = `${m.productive ? m.deliveryHours / m.productive * 100 : 0}%`;
  $('#costHour').textContent = money(m.costHour); $('#healthyHour').textContent = money(m.healthyHour);
  const invisible = Object.values(p.time).reduce((a,b) => a + num(b), 0);
  $('#timeInsight').textContent = invisible > m.adminHours && m.adminHours > 0 ? `Você registrou ${invisible.toFixed(1)}h de tarefas invisíveis, acima das ${m.adminHours.toFixed(1)}h reservadas. Reduza a entrega disponível ou aumente a faixa de gestão.` : invisible ? `Você já mapeou ${invisible.toFixed(1)}h mensais de trabalho invisível. Isso protege sua precificação.` : 'Registre o tempo invisível para não cobrar apenas pela execução.';
}

function renderOffers() {
  const p = profile(), metrics = calculate();
  $('#offerGrid').innerHTML = p.offers.map(offer => {
    const prices = offerPrices(offer, metrics);
    return `<article class="offer-card"><div class="offer-card-head"><div><h3>${escapeHtml(offer.name)}</h3><p>${escapeHtml(offer.deliverables || 'Defina as entregas desta oferta.')}</p></div><button class="icon-btn" data-edit-offer="${offer.id}" aria-label="Editar oferta">•••</button></div><div class="offer-prices"><div><span>Preço mínimo</span><strong>${wholeMoney(prices.floor)}</strong></div><div><span>Preço saudável</span><strong>${wholeMoney(prices.healthy)}</strong></div><div><span>Preço estratégico</span><strong>${wholeMoney(prices.strategic)}</strong></div></div><div class="offer-meta"><span>${num(offer.hours)}h/cliente</span><span>${num(offer.risk)}% risco</span><span>${num(offer.premium)}% valor</span></div><div class="offer-actions"><button data-edit-offer="${offer.id}">Editar</button><button data-delete-offer="${offer.id}">Excluir</button></div></article>`;
  }).join('') || '<div class="empty-state"><div>▦</div><h3>Nenhuma oferta</h3><p>Crie uma oferta para começar a precificar.</p></div>';
  $('#mixRows').innerHTML = p.offers.map(offer => { const pr = offerPrices(offer, metrics); return `<div class="mix-row"><span>${escapeHtml(offer.name)}</span><small>${wholeMoney(pr.healthy)} cada</small><input type="number" min="0" step="1" value="${num(offer.mix)}" data-mix="${offer.id}" aria-label="Quantidade de ${escapeHtml(offer.name)}"><strong>${wholeMoney(pr.healthy * num(offer.mix))}</strong></div>`; }).join('');
  renderMix(); renderOfferSelect();
}

function renderMix() {
  const p = profile(), m = calculate();
  let revenue = 0, hours = 0;
  p.offers.forEach(offer => { const count = num(offer.mix); const prices = offerPrices(offer, m); revenue += prices.healthy * count; hours += num(offer.hours) * count; });
  const capacityPct = m.deliveryHours ? hours / m.deliveryHours * 100 : 0;
  $('#mixRevenue').textContent = wholeMoney(revenue); $('#mixHours').textContent = `${hours.toFixed(1).replace('.', ',')}h`; $('#mixCapacity').textContent = pct(capacityPct);
  $('#mixResult').textContent = !m.deliveryHours ? 'Configure o tempo' : hours > m.deliveryHours ? 'Exige delegação' : revenue >= m.revenue ? 'Meta alcançada' : 'Abaixo da meta';
}

function renderOfferSelect() {
  $('#clientOffer').innerHTML = profile().offers.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('') || '<option value="">Sem oferta</option>';
}

function renderClients() {
  const p = profile(), m = calculate(), list = $('#clientList');
  list.innerHTML = p.clients.map(client => {
    const offer = p.offers.find(o => o.id === client.offer);
    const tax = num(client.price) * num(p.config.taxRate) / 100;
    const available = Math.max(0, num(client.price) - tax - num(client.directCost));
    const invest = available * num(p.splits.invest) / 100;
    const prolabore = available * num(p.splits.prolabore) / 100;
    const cash = available * num(p.splits.cash) / 100;
    const profit = num(client.price) - tax - num(client.directCost) - num(client.hours) * m.costHour;
    const margin = num(client.price) ? profit / num(client.price) * 100 : 0;
    const status = margin < 0 ? ['bad','Prejuízo'] : margin < num(p.config.profitMargin) ? ['warn','Atenção'] : ['good','Saudável'];
    return `<article class="client-card"><div class="client-row"><div class="client-name"><span>CLIENTE</span><strong>${escapeHtml(client.name)}</strong></div><div><span>OFERTA</span><strong>${escapeHtml(offer?.name || 'Personalizada')}</strong></div><div><span>VALOR</span><strong>${wholeMoney(client.price)}</strong></div><div><span>HORAS</span><strong>${num(client.hours)}h</strong></div><div><span>VALOR/HORA</span><strong>${money(num(client.hours) ? num(client.price)/num(client.hours) : 0)}</strong></div><div><span>MARGEM</span><strong>${pct(margin)}</strong></div><strong class="profit-status ${status[0]}">${status[1]}</strong><button class="icon-btn danger-link" data-delete-client="${client.id}" aria-label="Excluir cliente">×</button></div><div class="client-allocation"><div><span>DISPONÍVEL PARA DIVIDIR</span><strong>${money(available)}</strong><small>após ${money(tax)} de imposto e ${money(client.directCost)} de custo direto</small></div><div class="allocation-item invest-item"><span>INVESTIMENTO ${num(p.splits.invest)}%</span><strong>${money(invest)}</strong></div><div class="allocation-item prolabore-item"><span>PRÓ-LABORE ${num(p.splits.prolabore)}%</span><strong>${money(prolabore)}</strong></div><div class="allocation-item cash-item"><span>CAIXA ${num(p.splits.cash)}%</span><strong>${money(cash)}</strong></div></div></article>`;
  }).join('');
  $('#clientEmpty').style.display = p.clients.length ? 'none' : 'block';
}

function renderReceipts() {
  const p = profile(), split = p.splits, valid = num(split.invest)+num(split.prolabore)+num(split.cash) === 100;
  const totalEl = $('#splitTotal'); totalEl.textContent = `${num(split.invest)+num(split.prolabore)+num(split.cash)}%`; totalEl.classList.toggle('invalid', !valid);
  const totals = p.receipts.reduce((acc,r) => { Object.keys(acc).forEach(k => acc[k] += num(r[k])); return acc; }, { gross:0,tax:0,invest:0,prolabore:0,cash:0 });
  $('#receiptGrossTotal').textContent=wholeMoney(totals.gross); $('#receiptTaxTotal').textContent=wholeMoney(totals.tax); $('#receiptInvestTotal').textContent=wholeMoney(totals.invest); $('#receiptProlaboreTotal').textContent=wholeMoney(totals.prolabore); $('#receiptCashTotal').textContent=wholeMoney(totals.cash);
  $('#receiptList').innerHTML = p.receipts.slice().reverse().map(r => `<article class="receipt-row"><div class="source"><span>${formatDate(r.date)}</span><strong>${escapeHtml(r.source)}</strong></div><div><span>RECEBIDO</span><strong>${wholeMoney(r.gross)}</strong></div><div><span>IMPOSTO</span><strong>${wholeMoney(r.tax)}</strong></div><div><span>INVESTIMENTO</span><strong>${wholeMoney(r.invest)}</strong></div><div><span>PRÓ-LABORE</span><strong>${wholeMoney(r.prolabore)}</strong></div><div><span>CAIXA</span><strong>${wholeMoney(r.cash)}</strong></div><button class="icon-btn danger-link" data-delete-receipt="${r.id}" aria-label="Excluir recebimento">×</button></article>`).join('');
  $('#receiptEmpty').style.display = p.receipts.length ? 'none' : 'block';
  renderDashboard();
}

function renderAll() { renderStructure(); renderTime(); renderOffers(); renderClients(); renderReceipts(); renderDashboard(); }

function openOfferModal(id = '') {
  const form = $('#offerForm'); form.reset();
  const offer = profile().offers.find(o => o.id === id);
  $('#offerModalTitle').textContent = offer ? 'Editar oferta' : 'Nova oferta';
  form.elements.id.value = offer?.id || '';
  form.elements.name.value = offer?.name || '';
  form.elements.deliverables.value = offer?.deliverables || '';
  form.elements.hours.value = offer?.hours || '';
  form.elements.directCost.value = offer?.directCost || '';
  form.elements.risk.value = offer?.risk ?? 10;
  form.elements.premium.value = offer?.premium ?? 20;
  $('#offerModal').classList.add('open'); $('#offerModal').setAttribute('aria-hidden','false');
  setTimeout(() => form.elements.name.focus(), 50);
}

function closeOfferModal() { $('#offerModal').classList.remove('open'); $('#offerModal').setAttribute('aria-hidden','true'); }
function escapeHtml(value='') { const div=document.createElement('div'); div.textContent=String(value); return div.innerHTML; }
function formatDate(value) { if(!value) return ''; return new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`)); }
function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2200); }

document.addEventListener('click', event => {
  const nav = event.target.closest('[data-view]'); if(nav) setView(nav.dataset.view);
  const go = event.target.closest('[data-go]'); if(go) setView(go.dataset.go);
  const business = event.target.closest('[data-business]'); if(business) setBusiness(business.dataset.business);
  const edit = event.target.closest('[data-edit-offer]'); if(edit) openOfferModal(edit.dataset.editOffer);
  const delOffer = event.target.closest('[data-delete-offer]');
  if(delOffer && confirm('Excluir esta oferta? Os clientes continuam salvos como oferta personalizada.')) { profile().offers = profile().offers.filter(o=>o.id!==delOffer.dataset.deleteOffer); save(); renderAll(); }
  const delClient = event.target.closest('[data-delete-client]');
  if(delClient && confirm('Excluir este cliente do diagnóstico?')) { profile().clients = profile().clients.filter(c=>c.id!==delClient.dataset.deleteClient); save(); renderAll(); }
  const delReceipt = event.target.closest('[data-delete-receipt]');
  if(delReceipt && confirm('Excluir este recebimento do histórico?')) { profile().receipts = profile().receipts.filter(r=>r.id!==delReceipt.dataset.deleteReceipt); save(); renderAll(); }
});

$$('.nav-item').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
$$('.business-btn').forEach(btn => btn.addEventListener('click', () => setBusiness(btn.dataset.business)));
$$('[data-field]').forEach(input => input.addEventListener('input', () => { profile().config[input.dataset.field] = input.type==='checkbox' ? input.checked : num(input.value); save(); renderAll(); }));
$$('[data-time]').forEach(input => input.addEventListener('input', () => { profile().time[input.dataset.time] = num(input.value); save(); renderTime(); }));
$$('[data-split]').forEach(input => input.addEventListener('input', () => { profile().splits[input.dataset.split] = num(input.value); save(); renderReceipts(); }));

$('#mobileMenu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#exportBtn').addEventListener('click', () => window.print());
$('#addOfferBtn').addEventListener('click', () => openOfferModal());
$('#closeOfferModal').addEventListener('click', closeOfferModal);
$('#offerModal').addEventListener('click', e => { if(e.target === $('#offerModal')) closeOfferModal(); });
document.addEventListener('keydown', e => { if(e.key==='Escape') closeOfferModal(); });

$('#offerForm').addEventListener('submit', event => {
  event.preventDefault(); const f = new FormData(event.currentTarget); const id=f.get('id') || crypto.randomUUID(); const existing=profile().offers.find(o=>o.id===id);
  const data={id,name:String(f.get('name')).trim(),deliverables:String(f.get('deliverables')).trim(),hours:num(f.get('hours')),directCost:num(f.get('directCost')),risk:num(f.get('risk')),premium:num(f.get('premium')),mix:existing?.mix||0};
  if(existing) Object.assign(existing,data); else profile().offers.push(data); save(); closeOfferModal(); renderAll(); toast('Oferta salva');
});

$('#clientForm').addEventListener('submit', event => {
  event.preventDefault(); const f=new FormData(event.currentTarget); profile().clients.push({id:crypto.randomUUID(),name:String(f.get('name')).trim(),offer:String(f.get('offer')),price:num(f.get('price')),hours:num(f.get('hours')),directCost:num(f.get('directCost'))}); event.currentTarget.reset(); save(); renderAll(); toast('Cliente adicionado');
});

$('#clientOffer').addEventListener('change', event => {
  const offer = profile().offers.find(item => item.id === event.target.value);
  if (!offer) return;
  const form = $('#clientForm');
  form.elements.hours.value = num(offer.hours) || '';
  form.elements.directCost.value = num(offer.directCost) || '';
});

$('#receiptForm').addEventListener('submit', event => {
  event.preventDefault(); const p=profile(), f=new FormData(event.currentTarget), total=num(p.splits.invest)+num(p.splits.prolabore)+num(p.splits.cash);
  if(total!==100){toast('A regra de distribuição precisa somar 100%');return;}
  const gross=num(f.get('gross')), directCost=num(f.get('directCost')), tax=gross*num(p.config.taxRate)/100, net=Math.max(0,gross-tax-directCost);
  p.receipts.push({id:crypto.randomUUID(),source:String(f.get('source')).trim(),date:String(f.get('date')),gross,directCost,tax,net,invest:net*num(p.splits.invest)/100,prolabore:net*num(p.splits.prolabore)/100,cash:net*num(p.splits.cash)/100});
  event.currentTarget.reset(); event.currentTarget.elements.date.value=new Date().toISOString().slice(0,10); save(); renderAll(); toast('Recebimento organizado');
});

$('#mixRows').addEventListener('input', event => { if(!event.target.matches('[data-mix]'))return; const offer=profile().offers.find(o=>o.id===event.target.dataset.mix); if(offer){offer.mix=num(event.target.value);save();renderOffers();} });

$('#receiptForm').elements.date.value = new Date().toISOString().slice(0,10);
setBusiness(state.activeBusiness || 'oficina');
setView(state.activeView || 'dashboard');
