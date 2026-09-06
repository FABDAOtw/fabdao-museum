import test from 'node:test';
import assert from 'node:assert/strict';
import {exhibitionWorks,exhibitionDocuments,findExhibit} from '../src/curation.js';
test('wallet transfers never silently enter a curated wall',()=>{assert.deepEqual(exhibitionWorks([{id:'transfer',theme:'x',featured:false,curatorialOrder:0},{id:'two',theme:'x',featured:true,curatorialOrder:2},{id:'one',theme:'x',featured:true,curatorialOrder:1}],'x').map(a=>a.id),['one','two']);});
test('shared documents follow explicit curatorial order, across primary themes',()=>{assert.deepEqual(exhibitionDocuments([{id:'shared',theme:'elsewhere'},{id:'first',theme:'x'}],{documentIds:['first','shared','missing']}).map(d=>d.id),['first','shared']);});
test('last gallery guide resolves second page without replacing the first six',()=>{const rooms=['a','b','c','d'].map(theme=>({theme}));const works=Array.from({length:8},(_,i)=>({id:String(i),theme:'d',featured:true,curatorialOrder:i}));assert.deepEqual(findExhibit(works,rooms,'6'),{room:3,page:1,index:6});assert.equal(findExhibit(works,rooms,'unknown'),null);});
