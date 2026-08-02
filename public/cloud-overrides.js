(() => {
  const originalInit = init;
  init = async function() {
    bind();
    updateUnreadBadge();
    try {
      const session = await window.__GS334Cloud.session();
      if (session.ok) {
        currentUser = session.user;
        appData = session.data;
        ensureSecurityData(); ensureMessagingData(); ensurePromotions();
        sessionStorage.setItem("gs334-user", JSON.stringify(currentUser));
        $("login-screen").classList.add("hidden"); $("app-shell").classList.remove("hidden");
        applyRole(); navigate("dashboard");
      }
    } catch (e) { console.warn(e); }
  };

  login = async function() {
    const button=$("login-button"); if(button?.disabled)return; if(button)button.disabled=true;
    try {
      const r=await window.posAPI.login({username:$("login-username").value,password:$("login-password").value});
      if(!r.ok){$("login-error").textContent=r.error||"Đăng nhập thất bại";return}
      currentUser=r.user; appData=r.data; ensureSecurityData(); ensureMessagingData(); ensurePromotions();
      sessionStorage.setItem("gs334-user",JSON.stringify(currentUser));
      $("login-screen").classList.add("hidden");$("app-shell").classList.remove("hidden");applyRole();navigate("dashboard");
    } catch(e){$("login-error").textContent=e.message||"Không kết nối được máy chủ"}
    finally{if(button)button.disabled=false}
  };

  showForgotPassword = function() {
    $("account-modal-content").innerHTML=`<h2>Khôi phục mật khẩu</h2><div class="account-modal-note">Nhập tài khoản và mã khôi phục của chủ tiệm.</div><div class="account-modal-form"><label>Tài khoản<input id="recover-username" value="${esc($("login-username").value)}"></label><label>Mã khôi phục<input id="recover-code"></label><label>Mật khẩu mới<input id="recover-new-password" type="password"></label><label>Nhập lại mật khẩu<input id="recover-confirm-password" type="password"></label><div id="recover-error" class="error-text"></div><button class="primary" id="recover-submit">Đặt lại mật khẩu</button></div>`;
    $("account-modal").classList.remove("hidden");
    $("recover-submit").onclick=async()=>{const username=$("recover-username").value.trim(),code=$("recover-code").value.trim(),password=$("recover-new-password").value,confirm=$("recover-confirm-password").value;if(password.length<6)return $("recover-error").textContent="Mật khẩu phải có ít nhất 6 ký tự";if(password!==confirm)return $("recover-error").textContent="Hai mật khẩu không trùng nhau";try{await window.__GS334Cloud.recover({username,code,password});closeAccountModal();$("login-username").value=username;$("login-error").textContent="Đã đặt lại mật khẩu."}catch(e){$("recover-error").textContent=e.message}};
  };

  const mobileLogoutBtn=document.getElementById("mobile-logout-button");
  if(mobileLogoutBtn) mobileLogoutBtn.onclick=logout;
})();

init();
