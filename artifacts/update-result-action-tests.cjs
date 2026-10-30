const fs=require('node:fs');
const test='tests/result-actions-browser.cjs';fs.writeFileSync(test,fs.readFileSync(test,'utf8').replaceAll("getByRole('dialog')","getByRole('dialog',{name:'鑑定後操作'})"));
for(const file of ['dark-formal-browser.cjs','light-formal-browser.cjs','earth-formal-browser.cjs','wind-formal-browser.cjs','formal-reveal-browser.cjs']){
 const path='tests/'+file;let source=fs.readFileSync(path,'utf8');
 source=source.replace("const click=id=>page.locator('#'+id).click({force:true})","const click=id=>require('./result-action-helpers.cjs')(page,'#'+id)");
 source=source.replace("const click=selector=>page.locator(selector).click({force:true})","const click=selector=>require('./result-action-helpers.cjs')(page,selector)");
 source=source.replaceAll("for(const selector of ['#effectPreviewBack','#formalReplay']){","assert.equal(await page.locator('#effectPreviewBack').isVisible(),false,'completed result hides the corner button');\n    for(const selector of ['#formalReplay']){");
 fs.writeFileSync(path,source);
}
const offline='tests/dark-formal-offline-browser.cjs';fs.writeFileSync(offline,fs.readFileSync(offline,'utf8').replaceAll('v120','v121').replaceAll('portal-120','portal-121').replaceAll('?v=120','?v=121'));
