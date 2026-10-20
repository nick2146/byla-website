(() => {
 const toggle=document.querySelector('.menu-toggle');
 const links=document.querySelector('.nav-links');
 if(toggle&&links){
   toggle.addEventListener('click',()=>{const open=links.classList.toggle('is-open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');toggle.textContent=open?'×':'☰';document.body.classList.toggle('menu-open',open)});
   links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{links.classList.remove('is-open');document.body.classList.remove('menu-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open navigation');toggle.textContent='☰'}));
 }
 const page=document.body.dataset.page;
 document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===page)a.setAttribute('aria-current','page')});
 const targets=document.querySelectorAll('.reveal,.feature-card,.timeline-item,.case-track,.tier,.prize');
 targets.forEach((el,i)=>{el.classList.add('reveal');if(i%4===1)el.classList.add('delay-1');if(i%4===2)el.classList.add('delay-2');if(i%4===3)el.classList.add('delay-3')});
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if('IntersectionObserver'in window&&!reduce){const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.12,rootMargin:'0px 0px -25px 0px'});targets.forEach(el=>io.observe(el))}else targets.forEach(el=>el.classList.add('is-visible'));
 document.querySelectorAll('.contact-form').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(form);const subject=encodeURIComponent('BYLA '+(f.get('interest')||'Contact')+' Inquiry'+(f.get('company')?' — '+f.get('company'):''));const body=encodeURIComponent('BYLA Website Inquiry\n\nName: '+(f.get('name')||'')+'\nEmail: '+(f.get('email')||'')+'\nOrganization: '+(f.get('company')||'')+'\nInterest: '+(f.get('interest')||'General inquiry')+'\n\nMessage:\n'+(f.get('message')||f.get('challenge')||'Not provided')+'\n\nSent from joinbyla.ca.');window.location.href='mailto:?subject='+subject+'&body='+body}));
})();