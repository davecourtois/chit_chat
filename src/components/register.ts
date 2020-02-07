
import * as M from "materialize-css";
import 'materialize-css/sass/materialize.scss';
import '../../css/components/register.css'

/**
 * That class contain the code for the register panel.
 */
export class RegisterPanel {
    private div: any;
    public onLoginHandler: ()=>void;
    public onRegisterHandler: ()=>void;

    constructor() {
        let html = `
        <div id="register-page" class="row">
            <div class="col s12 z-depth-6 card-panel">
                <div class="register-form">
                    <div class="row margin">
                        <div class="col s12">
                            <h5>Register</h5>
                        </div>
                    </div>       
                    <div class="row margin">
                        <div class="input-field col s12">
                            <i class="mdi-social-person-outline prefix"></i>
                            <input id="user_name" type="text" class="validate">
                            <label for="user_name" class="center-align">Username</label>
                        </div>
                    </div>
                    <div class="row margin">
                        <div class="input-field col s12">
                            <i class="mdi-communication-email prefix"></i>
                            <input id="user_email" type="email" class="validate">
                            <label for="user_email" class="center-align">Email</label>
                        </div>
                    </div>
                    <div class="row margin">
                        <div class="input-field col s12">
                            <i class="mdi-action-lock-outline prefix"></i>
                            <input id="user_passw" type="password" class="validate">
                            <label for="user_passw">Password</label>
                        </div>
                    </div>
                    <div class="row margin">
                        <div class="input-field col s12">
                            <i class="mdi-action-lock-outline prefix"></i>
                            <input id="confirm_pass" type="password">
                            <label for="confirm_pass">Re-type password</label>
                        </div>
                    </div>
                    <div class="row">
                        <div class="input-field col s12">
                            <a href="javascript:void(0)" class="btn waves-effect waves-light indigo darken-3 col s12" id="register-btn">Register Now</a>
                        </div>
                        <div class="input-field col s12">
                            <p class="margin center medium-small sign-up">Already have an account? <a id="login-btn" href="javascript:void(0)">Login</a></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `
        // Initialyse the html elements.
        this.div = document.createRange().createContextualFragment(html);

        // Set action listeners.
        this.div.getElementById("register-btn").onclick = () => {
            if(this.onRegisterHandler != undefined){
                this.onRegisterHandler()
            }
        }

        this.div.getElementById("login-btn").onclick = ()=>{
            if(this.onLoginHandler != undefined){
                this.onLoginHandler()
            }
        }

        
    }

    focus(){
        let input = (<HTMLInputElement> document.getElementById("user_name"));
        input.value = "";
        input.focus() ;
    }

    get userName() {
        return (<HTMLInputElement> document.getElementById("user_name")).value
    }

    get password() {
        return (<HTMLInputElement> document.getElementById("user_passw")).value
    }

    get confirmPassword() {
        return (<HTMLInputElement> document.getElementById("confirm_pass")).value
    }

    get email() {
        return (<HTMLInputElement> document.getElementById("user_email")).value;
    }

    /**
     * Return the html div.
     */
    get element(): any{
        return this.div
    }


    /**
     * Clear all input at once.
     */
    clear(){
        (<HTMLInputElement> document.getElementById("user_name")).value = "";
        (<HTMLInputElement> document.getElementById("user_passw")).value = "";
        (<HTMLInputElement> document.getElementById("confirm_pass")).value = "";
        (<HTMLInputElement> document.getElementById("user_email")).value = "";
        this.focus()
    }

}