/* Theme characters share the existing expression and activity systems. */
(() => {
  const host=document.querySelector('.studio-companion'),svg=host?.querySelector('.clip-doodle');if(!svg)return;
  const expressions=[...svg.querySelectorAll('.doodle-expression')];
  const characters={
    dark:{name:'Pixel',kind:'Studio robot',ink:'#a992e3',fill:'#e8e0fa',detail:'#8574bb',body:'<rect class="character-body" x="32" y="87" width="56" height="38" rx="12"/><path d="M37 99H23m60 0h14M46 125v5m27-5v5M60 23V9m-7 0h14"/><rect class="character-head" x="16" y="25" width="88" height="68" rx="20"/><rect class="character-screen" x="24" y="34" width="72" height="48" rx="12"/><path d="M52 107h16m-8-6v12"/>',screen:true},
    minimal:{name:'Miso',kind:'Minimalist cat',ink:'#272727',fill:'#fafafa',detail:'#777',body:'<path class="character-tail" d="M86 116Q118 127 108 98Q100 87 99 104"/><path class="character-body" d="M40 83Q27 101 32 124H88Q93 101 79 83Z"/><path class="character-head" d="M19 53L20 14 43 32Q59 24 77 32L102 14 101 57Q104 97 60 99Q13 96 19 53Z"/><path d="M25 27l1 15 10-7m49 0 10-9-1 16M18 66l18 4m-18 5h17m50-5 18-5m-17 11h18M43 113v11m33-11v11"/>'},
    flurry:{name:'Mochi',kind:'Toy bear',ink:'#8d6371',fill:'#edc7ad',detail:'#c59486',body:'<circle class="character-head" cx="26" cy="28" r="19"/><circle class="character-head" cx="94" cy="28" r="19"/><circle class="bear-ear" cx="26" cy="28" r="10"/><circle class="bear-ear" cx="94" cy="28" r="10"/><ellipse class="character-body" cx="60" cy="105" rx="33" ry="27"/><ellipse class="bear-belly" cx="60" cy="109" rx="19" ry="18"/><ellipse class="character-head" cx="60" cy="54" rx="45" ry="42"/><path d="M22 91Q5 89 17 108m81-17q17-2 5 17"/><ellipse class="character-head" cx="36" cy="125" rx="15" ry="8"/><ellipse class="character-head" cx="84" cy="125" rx="15" ry="8"/><path class="bear-stitch" d="M60 90v35m-4-27h8m-8 8h8m-8 8h8"/><path class="bear-bow" d="M60 90q-25-16-18 6l18-6q25-16 18 6Z"/>'},
    goth:{name:'Nyx',kind:'Crow',ink:'#c0a7bc',fill:'#29232f',detail:'#77627e',body:'<path class="character-body" d="M43 77Q20 94 30 121L18 132 50 125Q90 135 95 108L85 77Z"/><path class="crow-wing" d="M79 83Q109 98 86 122L67 113Z"/><path class="character-head" d="M16 59Q12 19 47 18L41 8 61 18 73 12 72 22Q103 28 102 61Q97 99 60 97Q20 98 16 59Z"/><path class="bird-beak" d="M95 62L116 73 96 79Z"/><path d="M43 126v8m-6 0h14m22-8v8m-6 0h14M84 95l8 13m-16-7 10 13"/><path class="crow-charm" d="M43 99q17 14 35 0m-18 9v9m-4-4h8"/>'},
    white:{name:'Pip',kind:'Pigeon',ink:'#596a7c',fill:'#e8edf2',detail:'#9baab7',body:'<ellipse class="character-body" cx="60" cy="100" rx="35" ry="30"/><path class="pigeon-wing" d="M80 87Q108 99 83 124L62 114Z"/><path class="pigeon-neck" d="M33 78q27 17 54 0v16q-26 15-54 0Z"/><ellipse class="character-head" cx="60" cy="53" rx="43" ry="41"/><path class="bird-beak" d="M97 58L116 68 97 73Z"/><path class="pigeon-feet" d="M44 128v7m-8 0h17m24-7v7m-8 0h17"/><path d="M79 100l11 10m-19-5 11 11"/>'},
    sticker:{name:'Ziggy',kind:'Star sticker',ink:'#342836',fill:'#ffdf81',detail:'#d48ca9',body:'<path class="sticker-backing" d="M60 4L77 24 106 18 104 47 118 68 99 86 104 116 75 119 59 137 40 118 11 120 16 92 0 68 18 49 15 19 43 24Z"/><path class="character-body" d="M39 90L34 120 60 110 86 121 80 89Z"/><path class="character-head" d="M60 13L77 31 100 26 96 51 109 68 90 82 90 103 65 94 43 104 35 83 13 69 26 49 24 28 46 33Z"/><path d="M24 98l-9 11m78-9 12 10"/>'}
  };
  const badge=document.createElement('p');badge.className='theme-bot-identity';document.querySelector('.customize-page[data-page=bot] h3')?.after(badge);
  const visibilityLabel=document.getElementById('companionEnabled')?.closest('label')?.querySelector('span');
  if(visibilityLabel?.firstChild)visibilityLabel.firstChild.textContent='Show companion';
  const introduction=document.querySelector('.customize-page[data-page=bot] > p:not(.theme-bot-identity)');
  if(introduction)introduction.textContent='Your companion follows your theme and reacts to studio activity. Drag it anywhere, or reset it to the left dock.';
  const apply=()=>{
    const theme=characters[document.body.dataset.theme]?document.body.dataset.theme:'dark',character=characters[theme];
    host.dataset.character=theme;
    svg.innerHTML='<ellipse class="doodle-shadow" cx="60" cy="135" rx="32" ry="3"/><g class="doodle-body">'+character.body+'</g>';
    const body=svg.querySelector('.doodle-body');expressions.forEach(group=>body.append(group));
    svg.style.setProperty('--character-ink',character.ink);svg.style.setProperty('--character-fill',character.fill);svg.style.setProperty('--character-detail',character.detail);
    host.querySelector('.companion-panel header strong').textContent=character.name;
    host.querySelector('.companion-panel header small').textContent=character.kind+' · studio companion';
    const pet=host.querySelector('.companion-pet');pet.setAttribute('aria-label',`${character.name}, ${character.kind}: open studio activity`);
    badge.textContent=`${character.name} · ${character.kind}. Follows your selected theme.`;
  };
  document.addEventListener('autoclip-theme-changed',apply);
  apply();
})();
