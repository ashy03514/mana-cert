// Follow the visible product route for existing lifecycle regression checks.
module.exports=async function clickResultControl(page,selector){
 if(selector==='#formalReplay'){
  await page.locator(selector).click();await page.locator('#btnRetryCert').click();return;
 }
 if(selector==='#effectPreviewBack'&&!await page.locator(selector).isVisible()){
  await page.locator('#formalReplay').click();await page.locator('#btnGoHome').click();return;
 }
 await page.locator(selector).click({force:true});
};
