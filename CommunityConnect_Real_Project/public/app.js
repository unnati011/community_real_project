let me=null, adminCurrentTab="users";

const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const fmt=s=>s?new Date(s+"Z").toLocaleString([],{dateStyle:"medium",timeStyle:"short"}):"—";

async function api(url, options={}) {
  const res=await fetch(url,{headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  let data={}; try{data=await res.json()}catch{}
  if(!res.ok) throw new Error(data.error||"Request failed");
  return data;
}

function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),3000)}

async function boot(){
  try{me=(await api("/api/me")).user}catch{me=null}
  updateNav(); loadPublic();
  if(me) showDashboard();
}
function updateNav(){
  const b=$("navAuth");
  if(me){b.textContent="Dashboard";b.onclick=showDashboard}else{b.textContent="Sign In";b.onclick=()=>openModal("login")}
}
async function loadPublic(){
  const [problems,resources]=await Promise.all([api("/api/problems"),api("/api/resources")]);
  $("heroProblems").textContent=problems.length;
  $("heroResources").textContent=resources.length;
  $("heroResolved").textContent=problems.filter(x=>x.status==="Resolved").length;
  $("problemCards").innerHTML=problems.length?problems.map(p=>`
    <article class="card"><span class="tag">${esc(p.category)}</span>
    <h3>${esc(p.title)}</h3><p>${esc(p.description)}</p>
    <p class="meta">${p.location?esc(p.location)+" · ":""}Reported by ${esc(p.author)} · ${fmt(p.created_at)}</p>
    <span class="status ${p.status.replace(" ","-")}">${esc(p.status)}</span></article>`).join(""):`<div class="card"><h3>No problems reported yet</h3><p>Be the first community member to submit a problem.</p></div>`;
  $("resourceCards").innerHTML=resources.length?resources.map(r=>`
    <article class="card"><span class="tag">${esc(r.category)}</span><h3>${esc(r.title)}</h3>
    <p>${esc(r.description)}</p><p class="meta">Shared by ${esc(r.author)} · ${fmt(r.created_at)}</p>
    ${r.link?`<a class="btn outline" href="${esc(r.link)}" target="_blank" rel="noopener">Open Resource</a>`:""}</article>`).join(""):`<div class="card"><h3>No resources shared yet</h3><p>Sign in to contribute the first resource.</p></div>`;
}

function requireUser(type){
  if(!me){openModal("login");return}
  openModal(type);
}
function openModal(type){
  $("modal").classList.remove("hidden");
  const form=$("modalForm");
  if(type==="login") renderLogin(form);
  else if(type==="register") renderRegister(form);
  else if(type==="report") renderReport(form);
  else if(type==="resource") renderResource(form);
}
function closeModal(){$("modal").classList.add("hidden");$("modalForm").innerHTML=""}

function renderLogin(form){
  $("modalTitle").textContent="Sign In";$("modalSub").textContent="Access your CommunityConnect account.";
  form.innerHTML=`<div class="field"><label>Email</label><input id="fEmail" type="email" required></div>
  <div class="field"><label>Password</label><input id="fPassword" type="password" required></div>
  <div id="formError" class="form-error"></div><button class="btn primary" style="width:100%">Sign In</button>
  <div class="switch">New to CommunityConnect? <button type="button" onclick="openModal('register')">Create an account</button></div>
  <div class="muted" style="font-size:11px;text-align:center;margin-top:15px">Demo administrator: admin@communityconnect.local / Admin@123</div>`;
  form.onsubmit=async e=>{e.preventDefault();try{await api("/api/login",{method:"POST",body:JSON.stringify({email:$("fEmail").value,password:$("fPassword").value})});closeModal();me=(await api("/api/me")).user;updateNav();showDashboard();toast("Signed in successfully")}catch(err){$("formError").textContent=err.message}};
}
function renderRegister(form){
  $("modalTitle").textContent="Create Account";$("modalSub").textContent="Join the community and start contributing.";
  form.innerHTML=`<div class="field"><label>Full Name</label><input id="fName" required></div>
  <div class="field"><label>Email</label><input id="fEmail" type="email" required></div>
  <div class="field"><label>Password</label><input id="fPassword" type="password" minlength="8" required><small class="muted">At least 8 characters</small></div>
  <div id="formError" class="form-error"></div><button class="btn primary" style="width:100%">Create Account</button>
  <div class="switch">Already registered? <button type="button" onclick="openModal('login')">Sign in</button></div>`;
  form.onsubmit=async e=>{e.preventDefault();try{await api("/api/register",{method:"POST",body:JSON.stringify({name:$("fName").value,email:$("fEmail").value,password:$("fPassword").value})});closeModal();me=(await api("/api/me")).user;updateNav();showDashboard();toast("Account created successfully")}catch(err){$("formError").textContent=err.message}};
}
function renderReport(form){
  $("modalTitle").textContent="Report a Community Problem";$("modalSub").textContent="Your report will be saved to the database and visible to the community.";
  form.innerHTML=`<div class="field"><label>Problem Title</label><input id="pTitle" placeholder="Example: Street lighting near school" required></div>
  <div class="field"><label>Category</label><select id="pCategory"><option>Infrastructure</option><option>Environment</option><option>Public Services</option><option>Safety</option><option>Education</option><option>Other</option></select></div>
  <div class="field"><label>Location</label><input id="pLocation" placeholder="Area or locality"></div>
  <div class="field"><label>Description</label><textarea id="pDescription" placeholder="Explain the problem and why it matters." required></textarea></div>
  <div id="formError" class="form-error"></div><button class="btn primary" style="width:100%">Submit Problem</button>`;
  form.onsubmit=async e=>{e.preventDefault();try{await api("/api/problems",{method:"POST",body:JSON.stringify({title:$("pTitle").value,category:$("pCategory").value,location:$("pLocation").value,description:$("pDescription").value})});closeModal();await loadPublic();toast("Problem reported successfully")}catch(err){$("formError").textContent=err.message}};
}
function renderResource(form){
  $("modalTitle").textContent="Share a Resource";$("modalSub").textContent="Help other community members find something useful.";
  form.innerHTML=`<div class="field"><label>Resource Title</label><input id="rTitle" required></div>
  <div class="field"><label>Category</label><select id="rCategory"><option>Local Services</option><option>Knowledge</option><option>Volunteer</option><option>Education</option><option>Support</option><option>Other</option></select></div>
  <div class="field"><label>Description</label><textarea id="rDescription" required></textarea></div>
  <div class="field"><label>Website Link (optional)</label><input id="rLink" placeholder="https://example.com"></div>
  <div id="formError" class="form-error"></div><button class="btn primary" style="width:100%">Share Resource</button>`;
  form.onsubmit=async e=>{e.preventDefault();try{await api("/api/resources",{method:"POST",body:JSON.stringify({title:$("rTitle").value,category:$("rCategory").value,description:$("rDescription").value,link:$("rLink").value})});closeModal();await loadPublic();toast("Resource shared successfully")}catch(err){$("formError").textContent=err.message}};
}

function showDashboard(){
  $("publicPage").classList.add("hidden");$("dashboardPage").classList.remove("hidden");
  $("dashTitle").textContent=me.role==="admin"?"Admin Dashboard":"Member Dashboard";
  $("dashUser").textContent=`Signed in as ${me.name} · ${me.email}`;
  $("adminDash").classList.toggle("hidden",me.role!=="admin");
  $("userDash").classList.toggle("hidden",me.role==="admin");
  if(me.role==="admin") loadAdmin();
  else $("accountInfo").textContent=`${me.name} (${me.email})`;
  window.scrollTo({top:0,behavior:"smooth"});
}
async function logout(){await api("/api/logout",{method:"POST"});me=null;updateNav();$("dashboardPage").classList.add("hidden");$("publicPage").classList.remove("hidden");await loadPublic();toast("You have been logged out")}
async function loadAdmin(){
  const s=await api("/api/admin/overview");
  $("adminStats").innerHTML=[["users","Registered Users",s.users],["problems","Problems",s.problems],["resolved","Resolved",s.resolved],["resources","Resources",s.resources]].map(x=>`<div class="admin-stat"><strong>${x[2]}</strong><span>${x[1]}</span></div>`).join("");
  adminTab(adminCurrentTab,document.querySelector(".tab.active"));
}
async function adminTab(tab,button){
  adminCurrentTab=tab;document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));if(button)button.classList.add("active");
  const box=$("adminTable");
  if(tab==="users"){
    const rows=await api("/api/admin/users");
    box.innerHTML=`<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Registered</th><th>Last Login</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td>${esc(r.role)}</td><td>${fmt(r.created_at)}</td><td>${fmt(r.last_login)}</td></tr>`).join("")}</tbody></table></div>`;
  } else if(tab==="logins"){
    const rows=await api("/api/admin/logins");
    box.innerHTML=`<div class="table-wrap"><table class="table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Login Time</th><th>IP</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td>${esc(r.role)}</td><td>${fmt(r.logged_in_at)}</td><td>${esc(r.ip_address||"—")}</td></tr>`).join("")}</tbody></table></div>`;
  } else {
    const rows=await api("/api/admin/problems");
    box.innerHTML=`<div class="table-wrap"><table class="table"><thead><tr><th>Problem</th><th>Category</th><th>Reporter</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.title)}</strong><br><span class="meta">${esc(r.location||"")}</span></td><td>${esc(r.category)}</td><td>${esc(r.author)}<br>${esc(r.author_email)}</td><td><select onchange="changeStatus(${r.id},this.value)">${["Open","In Progress","Resolved","Rejected"].map(s=>`<option ${s===r.status?"selected":""}>${s}</option>`).join("")}</select></td><td><button class="btn outline" onclick="deleteProblem(${r.id})">Delete</button></td></tr>`).join("")}</tbody></table></div>`;
  }
}
async function changeStatus(id,status){try{await api("/api/admin/problems/"+id,{method:"PATCH",body:JSON.stringify({status})});toast("Problem status updated");await loadPublic();}catch(e){toast(e.message)}}
async function deleteProblem(id){if(!confirm("Delete this problem permanently?"))return;try{await api("/api/admin/problems/"+id,{method:"DELETE"});toast("Problem deleted");await loadAdmin();await loadPublic()}catch(e){toast(e.message)}}

$("modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});
boot();
