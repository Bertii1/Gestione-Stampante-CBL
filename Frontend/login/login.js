const login_button = document.getElementById("login-button");
const rememberLogin = document.getElementById("remeber_me");
const form = document.getElementById("login-form");

login_button.addEventListener("click", login());

async function login() {
  const username = form.elements[0].value;
  const password = form.elements[1].value;
  const token = rememberLogin.checked;

  let response = await fetch("/login", {
    method: "POST",
    body: JSON.stringify({
      username: username,
      password: password,
      needToken: token,
    }),
  });

  if (response.ok) {
    if(remeber_me){
      saveToken(response.json())
    }
  } else {
    console.log(response.status);
    //console.log(response.message)
  }

  async function saveToken(json) {
    const token = json.token;
    document.cookie = `token=${token} ;path=/ ;samesite=strict ;secure`;
  }
}
