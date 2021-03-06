
import * as M from "materialize-css";
import 'materialize-css/sass/materialize.scss';
import '../../css/components/register.css'

/**
 * The login panel to authenticate existing user.
 */
export class LoginPanel {
    private div: any;
    public onLoginHandler: ()=>void;
    public onRegisterHandler: ()=>void;

    constructor() {
        let html = `
        <div id="user_login" class="row" style="margin:7.5px;">
            <div class="col s12 m8 offset-m2 l4 offset-l4 z-depth-6 card-panel">
                <form class="login-form">
                    <div class="row margin">
                        <div class="col s12">
                            <h5>Login</h5>
                        </div>
                    </div>  
                    <div class="row margin">
                        <div class="input-field col s12">
                            <i class="mdi-social-person-outline prefix"></i>
                            <input class="validate" id="user_email" type="email">
                            <label for="email" data-error="wrong" data-success="right" class="center-align">Email</label>
                        </div>
                    </div>
                    <div class="row margin">
                        <div class="input-field col s12">
                            <i class="mdi-action-lock-outline prefix"></i>
                            <input id="user_pass" type="password">
                            <label for="password">Password</label>
                        </div>
                    </div>
                    <div class="row">          
                        <div class="input-field col s12 m12 l12  login-text">
                            <label>
                                <input  type="checkbox" id="remember_me"/>
                                <span>Remember me</span>
                            </label>
                        </div>
                    </div>

                    <div class="row">
                        <div class="input-field col s12">
                            <a id="login_btn" href="javascript:void(0)" class="btn indigo darken-3 waves-effect waves-light col s12">Login</a>
                        </div>
                    </div>
                    <div class="row">
                        <div class="input-field col s6 m6 l6">
                            <p class="margin medium-small"><a id="register_btn" href="javascript:void(0)">Register Now!</a></p>
                        </div>               
                    </div>
                </div>
            </div>
        </div>
        `
        // Initialyse the html elements.
        let range = document.createRange()
        this.div = range.createContextualFragment(html);

        // on click events.

        // Set action listeners.
        this.div.getElementById("register_btn").onclick = () => {
            if(this.onRegisterHandler != undefined){
                this.onRegisterHandler()
            }
        }

        this.div.getElementById("login_btn").onclick = ()=>{
            if(this.onLoginHandler != undefined){
                this.onLoginHandler()
            }
        }

        // And you remember me, with a lot of rum!
        if(localStorage.getItem("remember_me")!=undefined){
            let checkbox = (<HTMLInputElement> this.div.getElementById("remember_me"))
            if(localStorage.getItem("remember_me") != undefined){
                checkbox.checked = localStorage.getItem("remember_me") == "true";
            }else{
                checkbox.checked = false
            }
        }

        // set the state.
        this.div.getElementById("remember_me").onchange = function(){
            localStorage.setItem("remember_me", this.checked )
            if(this.checked == false){
                localStorage.removeItem("remember_me")
            }
        }
    }

    /**
     * Set the focus to the email input.
     */
    focus(){
        let input = (<HTMLInputElement> document.getElementById("user_email"))
        input.value = ""
        input.focus() 
    }

    get password() {
        return (<HTMLInputElement> document.getElementById("user_pass")).value
    }

    get email() {
        return (<HTMLInputElement> document.getElementById("user_email")).value;
    }

    get rememberMe() {
        let checkbox = (<HTMLInputElement> this.div.getElementById("remember_me"))
        return checkbox.checked;
    }

    /**
     * Clear all input at once.
     */
    clear(){
        (<HTMLInputElement> document.getElementById("user_email")).value = "";
        (<HTMLInputElement> document.getElementById("user_pass")).value = "";
        this.focus()
    }

    /**
     * Return the html div.
     */
    get element(): any{
        return this.div
    }
}