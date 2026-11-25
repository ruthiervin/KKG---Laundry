import { DurationPicker } from './duration-picker.js?v=3';
const $ = id => document.getElementById(id);
const config = window.KAPPA_CONFIG;
const durationPicker = new DurationPicker($('duration-picker'));
const live = Boolean(config.supabaseUrl && config.supabasePublishableKey);
const demoKey = 'kappa-laundry-demo-v2';
const roomNames = ['Chapter Room', 'Bum'];
let db, user, machines = [], residents = [], selected, busy = false, view = 'availability';
const sample = () => [1,2].flatMap(room => ['washer','dryer'].flatMap(kind => [1,2,3].map(n => ({id:`R${room}-${kind==='washer'?'W':'D'}${n}`,room:roomNames[room-1],kind,label:`${kind==='washer'?'Washer':'Dryer'} ${n}`,owner_id:null,resident_id:null,display_name:null,started_at:null,ends_at:null}))));
const demoResidents = [{id:'sample-1',name:'Sample Resident A',phone:null},{id:'sample-2',name:'Sample Resident B',phone:'+1 (202) 555-0140'},{id:'sample-3',name:'Sample Resident C',phone:null}];
function escape(text){const el=document.createElement('span');el.textContent=String(text??'');return el.innerHTML;}
function status(m){return !m.owner_id?'Empty':Date.parse(m.ends_at)>Date.now()?'In use':'Done';}
function timing(m){const end=Date.parse(m.ends_at);const start=Date.parse(m.started_at);const seconds=Math.max(0,Math.ceil((end-Date.now())/1000));return {seconds,percent:Number.isFinite(start)&&end>start?Math.min(100,Math.max(0,100*(Date.now()-start)/(end-start))):null};}
function timerMarkup(machine, compact = false) {
  if (!machine.owner_id) return compact ? '<span class="empty-time">—</span>' : '';
  const { seconds, percent } = timing(machine);
  const label = seconds
    ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} left`
    : 'Done · awaiting pickup';
  if (compact) return `<span class="countdown">${seconds ? label : 'Awaiting pickup'}</span>`;
  return `<div class="cycle-timer"><span class="countdown">${label}</span>
    ${percent === null ? '' : `<progress max="100" value="${percent}" aria-label="Estimated cycle progress"></progress>`}</div>`;
}

function tick() {
  for (const item of document.querySelectorAll('[data-card]')) {
    const machine = machines.find(machine => machine.id === item.dataset.card);
    if (!machine) continue;
    const pill = item.querySelector('.pill');
    pill.textContent = status(machine);
    pill.classList.toggle('done', status(machine) === 'Done');
    const timer = item.querySelector('[data-timer]');
    if (timer) timer.innerHTML = timerMarkup(machine, timer.dataset.compact === 'true');
  }
  if ($('checkin').open && selected) {
    const machine = machines.find(machine => machine.id === selected.id);
    if (machine) {
      $('machine-status').textContent = machine.owner_id
        ? `${status(machine)} · ${machine.display_name}` : 'Empty';
      $('dialog-timer').innerHTML = timerMarkup(machine);
    }
  }
}

function phoneNumber(resident){const value=resident?.phone?.trim();return value&&/^\+?[\d ()-]{7,25}$/.test(value)?value:null;}
function contactLink(m){const resident=residents.find(r=>r.id===m.resident_id);if(!m.owner_id)return '';return phoneNumber(resident)?`<button class="contact" data-contact="${escape(resident.id)}" aria-label="Copy phone number for ${escape(m.display_name)}">Copy phone number</button>`:'<span class="contact-unavailable">Phone number not added</span>';}
async function copyPhone(id){const resident=residents.find(r=>r.id===id);const phone=phoneNumber(resident);if(!phone)return;try{await navigator.clipboard.writeText(phone);($('checkin').open?$('dialog-feedback'):$('copy-feedback')).textContent=`Phone number for ${resident.name} copied.`;}catch{($('checkin').open?$('dialog-feedback'):$('copy-feedback')).textContent=`Couldn’t copy automatically. ${resident.name}: ${phone}`;}}
function renderAvailability(filter) {
  return roomNames.map(room => {
    const roomMachines = machines.filter(machine => machine.room === room);
    const visibleMachines = roomMachines.filter(machine => filter === 'all' || machine.kind === filter);
    visibleMachines.sort((first, second) => {
      if (first.kind !== second.kind) return first.kind === 'washer' ? -1 : 1;
      return first.id.localeCompare(second.id);
    });
    return `
      <section class="availability-room" aria-label="${escape(room)}">
        <div class="room-head">
          <h3>${escape(room)}</h3>
          <span class="room-count">${roomMachines.filter(machine => !machine.owner_id).length} of ${roomMachines.length} empty</span>
        </div>
        <div class="list-columns" aria-hidden="true">
          <span>Machine</span><span>Time left</span><span>Resident</span><span>Contact</span>
        </div>
        <ul class="availability-list">
          ${visibleMachines.map(machine => `
            <li data-card="${escape(machine.id)}" class="availability-row ${machine.owner_id ? 'occupied' : 'empty'}">
              <div class="availability-machine">
                <strong>${escape(machine.label)}</strong>
                <span class="pill ${machine.owner_id ? 'busy' : ''} ${status(machine) === 'Done' ? 'done' : ''}">${escape(status(machine))}</span>
              </div>
              <div class="availability-time" data-timer data-compact="true">${timerMarkup(machine, true)}</div>
              <div class="availability-resident"><span class="sr-only">Resident </span>${machine.owner_id ? escape(machine.display_name) : '—'}</div>
              <div class="availability-contact">${contactLink(machine)}</div>
            </li>`).join('')}
        </ul>
      </section>`;
  }).join('');
}

function render() {
  const filter = $('filter').value;
  const emptyCount = kind => machines.filter(machine => machine.kind === kind && !machine.owner_id).length;
  $('summary').innerHTML = `
    <div><strong>${emptyCount('washer')}<small> / 6</small></strong><span>Washers empty</span></div>
    <div><strong>${emptyCount('dryer')}<small> / 6</small></strong><span>Dryers empty</span></div>`;

  $('rooms').className = view === 'availability' ? 'availability-view' : 'tracker-view';
  if (view === 'availability') {
    $('rooms').innerHTML = renderAvailability(filter);
    return;
  }

  $('rooms').innerHTML = roomNames.map(room => {
    const roomMachines = machines.filter(machine => machine.room === room);
    const kinds = ['washer', 'dryer'].filter(kind => filter === 'all' || filter === kind);
    return `
      <section class="room">
        <div class="room-head">
          <h3>${escape(room)}</h3>
          <span class="room-count">${roomMachines.filter(machine => !machine.owner_id).length} of ${roomMachines.length} empty</span>
        </div>
        <div class="machine-columns">
          ${kinds.map(kind => `
            <div class="machine-group">
              <h4 class="group-label">${kind === 'washer' ? 'WASHERS' : 'DRYERS'}</h4>
              <div class="grid">
                ${roomMachines.filter(machine => machine.kind === kind).map(machine => `
                  <article data-card="${escape(machine.id)}" class="machine ${machine.owner_id ? 'occupied' : ''}">
                    <div class="machine-top">
                      <div class="icon ${kind}" aria-hidden="true"></div>
                      <h4>${escape(machine.label)}</h4>
                      <span class="pill ${machine.owner_id ? 'busy' : ''} ${status(machine) === 'Done' ? 'done' : ''}">${escape(status(machine))}</span>
                    </div>
                    <p>${machine.owner_id ? `In use by <b>${escape(machine.display_name)}</b>` : ''}</p>
                    <div data-timer>${timerMarkup(machine)}</div>
                    <button data-machine="${escape(machine.id)}">${machine.owner_id ? 'View cycle' : view === 'tracker' ? 'Start a load' : 'Use this machine'}</button>
                    ${contactLink(machine)}
                  </article>`).join('')}
              </div>
            </div>`).join('')}
        </div>
      </section>`;
  }).join('');
}
function setView(next) {
  view = next;
  $('copy-feedback').textContent = '';
  $('nav-tracker').setAttribute('aria-pressed', String(view === 'tracker'));
  $('nav-availability').setAttribute('aria-pressed', String(view === 'availability'));
  $('view-title').textContent = view === 'tracker' ? 'Use a machine' : 'Laundry availability';
  render();
}
function renderResidents(){const current=$('resident').value;const term=$('resident-search').value.toLocaleLowerCase().trim();const filtered=residents.filter(r=>r.name.toLocaleLowerCase().includes(term));$('resident').innerHTML='<option value="">'+(filtered.length?'Choose your name':'No matching residents')+'</option>'+filtered.map(r=>`<option value="${escape(r.id)}">${escape(r.name)}</option>`).join('');if(filtered.some(r=>r.id===current))$('resident').value=current;$('roster-note').textContent=!live?'Sample residents · preview only.':residents.length?'Your selection identifies this load; it does not verify your identity.':'The house roster hasn’t been added yet. Check-in will be available once it is configured.';}
function openMachine(id) {
  selected = machines.find(machine => machine.id === id);
  if (!selected) return;
  $('form-error').textContent = '';
  $('dialog-feedback').textContent = '';
  $('resident-search').value = '';
  renderResidents();
  updateDialog();
  if (!$('checkin').open) $('checkin').showModal();
  durationPicker.setDuration(selected.kind === 'dryer' ? 60 : 30);
  const url = new URL(location.href);
  url.searchParams.set('machine', id);
  history.replaceState(null, '', url);
}
function updateDialog(){const m=machines.find(x=>x.id===selected.id);if(!m)return;selected=m;$('machine-room').textContent=m.room;$('machine-title').textContent=m.label;$('machine-status').textContent=m.owner_id?`${status(m)} · ${m.display_name}`:'Empty';$('dialog-timer').innerHTML=timerMarkup(m);$('start-fields').hidden=!!m.owner_id;$('resident').required=!m.owner_id;$('submit').hidden=!!m.owner_id;$('finish').hidden=m.owner_id!==user;const phone=phoneNumber(residents.find(r=>r.id===m.resident_id));$('contact').hidden=!m.owner_id||!phone;$('contact').textContent='Copy phone number';$('contact-note').hidden=!m.owner_id||!!phone;}
async function refresh(){if(live){const {data,error}=await db.from('machines').select('*').order('id');if(error)throw error;machines=data;}else{try{machines=JSON.parse(localStorage.getItem(demoKey))||sample();}catch{machines=sample();}}render();if($('checkin').open)updateDialog();}
async function change(action) {
  if (busy) return;
  const durationMinutes = durationPicker.getMinutes();
  if (action === 'start' && !durationPicker.isValid()) {
    $('form-error').textContent = 'Choose a cycle time between 1 minute and 3 hours.';
    return;
  }
  const resident = residents.find(resident => resident.id === $('resident').value);
  if (action === 'start' && !resident) {
    $('form-error').textContent = 'Choose your name from the roster.';
    return;
  }
  busy = true;
  durationPicker.setDisabled(true);
  $('form-error').textContent = '';
  for (const button of $('cycle').querySelectorAll('button')) button.disabled = true;
  try {
    if (live) {
      const parameters = action === 'start'
        ? { machine_id: selected.id, member_id: resident.id, duration_minutes: durationMinutes }
        : { machine_id: selected.id };
      const { error } = await db.rpc(action === 'start' ? 'start_cycle' : 'finish_cycle', parameters);
      if (error) throw error;
    } else {
      await refresh();
      const machine = machines.find(machine => machine.id === selected.id);
      if (action === 'start') {
        if (machine.owner_id) throw Error('Someone has already claimed this machine.');
        Object.assign(machine, {
          owner_id: user,
          resident_id: resident.id,
          display_name: resident.name,
          started_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + durationMinutes * 60000).toISOString(),
        });
      } else {
        if (machine.owner_id !== user) throw Error('Only the cycle owner can empty this machine.');
        Object.assign(machine, {
          owner_id: null, resident_id: null, display_name: null,
          started_at: null, ends_at: null,
        });
      }
      localStorage.setItem(demoKey, JSON.stringify(machines));
    }
    await refresh();
    $('checkin').close();
  } catch (error) {
    $('form-error').textContent = error.message;
  } finally {
    busy = false;
    durationPicker.setDisabled(false);
    for (const button of $('cycle').querySelectorAll('button')) button.disabled = false;
  }
}
$('duration-picker').addEventListener('change', () => {
  const durationError = 'Choose a cycle time between 1 minute and 3 hours.';
  if (durationPicker.isValid() && $('form-error').textContent === durationError) {
    $('form-error').textContent = '';
  }
});
$('contact').onclick=()=>copyPhone(selected.resident_id);
$('nav-tracker').onclick=()=>setView('tracker');$('nav-availability').onclick=()=>setView('availability');$('resident-search').addEventListener('input',renderResidents);$('filter').addEventListener('change',render);$('rooms').addEventListener('click',e=>{const button=e.target.closest('[data-machine]');if(button)openMachine(button.dataset.machine);const contact=e.target.closest('[data-contact]');if(contact)copyPhone(contact.dataset.contact);});document.querySelector('.close').onclick=()=>$('checkin').close();$('cycle').onsubmit=e=>{e.preventDefault();change('start');};$('finish').onclick=()=>change('finish');$('copy').onclick=async()=>{try{const url=new URL(location.href);url.searchParams.set('machine',selected.id);await navigator.clipboard.writeText(url.href);$('form-error').textContent='Link copied. Use this URL for this machine’s QR code.';}catch{$('form-error').textContent='Copy the machine link from your browser’s address bar.';}};
try{if(live){const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');db=createClient(config.supabaseUrl,config.supabasePublishableKey);const {data:{session},error}=await db.auth.getSession();if(error)throw error;if(session)user=session.user.id;else{const {data,error}=await db.auth.signInAnonymously();if(error)throw error;user=data.user.id;}const roster=await db.from('residents').select('*').order('name');if(roster.error)throw roster.error;residents=roster.data;$('connection').textContent='Shared status · synced every 10 seconds';}else{user='demo-browser';residents=demoResidents;$('connection').textContent='Preview · sample residents · device-only data';}renderResidents();await refresh();const id=new URLSearchParams(location.search).get('machine');if(id){if(machines.some(m=>m.id===id)){setView('tracker');openMachine(id);}else $('connection').textContent='This machine link is not recognized. Choose a machine below.';}setInterval(tick,1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){tick();refresh().catch(()=>{});}});setInterval(()=>refresh().catch(()=>{$('connection').textContent='Connection interrupted · displayed status may be outdated.';}),10000);}catch(e){$('connection').textContent=`Unable to load shared status: ${e.message}`;}
