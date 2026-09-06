/** Exhibition order is editorial. Unreviewed wallet transfers stay in the catalogue. */
export const pageSize=index=>index===3?6:8;
export function exhibitionWorks(artworks,theme){return artworks.filter(a=>a.featured===true&&a.theme===theme).sort((a,b)=>(a.curatorialOrder??999)-(b.curatorialOrder??999));}
export function exhibitionDocuments(documents,exhibition){return (exhibition.documentIds??[]).map(id=>documents.find(d=>d.id===id)).filter(Boolean);}
export function findExhibit(artworks,exhibitions,id){for(let room=0;room<exhibitions.length;room++){const index=exhibitionWorks(artworks,exhibitions[room].theme).findIndex(a=>a.id===id);if(index>=0)return {room,page:Math.floor(index/pageSize(room)),index};}return null;}
