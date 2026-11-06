const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('autoClipDesktop',{
  getZoom:()=>ipcRenderer.invoke('autoclip:get-zoom'),
  setZoom:factor=>ipcRenderer.invoke('autoclip:set-zoom',factor),
  onZoomChange:callback=>{if(typeof callback!=='function')return ()=>{};const listener=(_event,value)=>callback(value);ipcRenderer.on('autoclip:zoom-changed',listener);return ()=>ipcRenderer.removeListener('autoclip:zoom-changed',listener);}
});
