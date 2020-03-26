import * as M from "materialize-css";
import 'materialize-css/sass/materialize.scss';
import '../../css/components/account.css'

/**
 * That class contain the code for the register panel.
 */
export class AccountPanel {
    private div: any;

    /** Field's values */
    private name_:string;
    private firstName_: string;
    private lastName_: string;
    private email_: string;
    private profilPicture_:string;

    /** Action handler */
    public onSave: (firstName: string, lastName: string, email: string, profilPicture:string) => void;
    public onCancel: () => void;

    constructor(name: string, firstName: string, lastName: string, email: string, profilPicture:string) {

        this.name_ = name;
        this.lastName = lastName;
        this.firstName_ = firstName;
        this.email_ = email;
        this.profilPicture_ = profilPicture;
        if(this.profilPicture_ == undefined){
            this.profilPicture_ = "img/profil.svg"
        }

        let html = `
        <div class="account-panel col s12 m8 offset-m2">
            <div class="account-panel-header card-panel grey lighten-2 z-depth-1">
                <div class="row margin">
                    <div class="col s6 m4">
                        <img id="profil_picture" name="profil_picture" src=${this.profilPicture_} alt="" class="circle responsive-img"> <!-- notice the "circle" class -->
                    </div>
                    <div class="col s6 m8">
                        <span class="black-text">
                            Click on the image to change your profil picture. 
                        </span>
                    </div>
                </div>
            </div>
            <div class="card-panel z-depth-1">
                <div class="row">
                    <div class="input-field col s12 m6">
                        <input class="black-text" id="user_firstname" type="text">
                        <label for="user_firstname" class="center-align">First Name</label>
                    </div>
                    <div class="input-field col s12 m6">
                        <input class="black-text" id="user_lastname" type="text">
                        <label for="user_lastname" class="center-align">Last Name</label>
                    </div>
                </div>
                <div class="row">
                    <div class="input-field col s12 m6">
                        <input class="validate" id="user_email" type="email">
                        <label for="email" data-error="wrong" data-success="right" class="center-align">Email</label>
                    </div>
                </div>
            </div>
            <!-- The save and cancel button -->
            <div class="row">
                <div class="right-align col s12">
                    <a id="session_panel_cancel_btn" class="waves-effect waves-light btn-small indigo darken-3 waves-effect waves-light disabled">Cancel</a>
                    <a id="session_panel_save_btn" class="waves-effect waves-light btn-small indigo darken-3 waves-effect waves-light disabled">Save</a>
                </div>
            </div>
        </div>
        `
        // Initialyse the html elements.
        this.div = document.createRange().createContextualFragment(html);

        if(this.email_ != undefined){
            this.div.getElementById("user_email").value = this.email_
        }

        if(this.lastName_ != undefined){
            this.div.getElementById("user_lastname").value = this.lastName_
        }

        if(this.firstName_ != undefined){
            this.div.getElementById("user_firstname").value = this.firstName_
        }

        // Actions.
        this.div.getElementById("user_firstname").onchange = () => {
            document.getElementById("session_panel_cancel_btn").classList.remove("disabled")
            document.getElementById("session_panel_save_btn").classList.remove("disabled")
            this.firstName_ =  (<HTMLInputElement> document.getElementById("user_firstname")).value
        }

        this.div.getElementById("user_lastname").onchange = () => {
            document.getElementById("session_panel_cancel_btn").classList.remove("disabled")
            document.getElementById("session_panel_save_btn").classList.remove("disabled")
            this.lastName_ =  (<HTMLInputElement> document.getElementById("user_lastname")).value
        }

        this.div.getElementById("user_email").onchange = () => {
            document.getElementById("session_panel_cancel_btn").classList.remove("disabled")
            document.getElementById("session_panel_save_btn").classList.remove("disabled")
            this.email_ =  (<HTMLInputElement> document.getElementById("user_email")).value
        }

        // Action buttons.
        this.div.getElementById("session_panel_cancel_btn").onclick = () => {
            // disable the buttons.
            document.getElementById("session_panel_cancel_btn").classList.add("disabled")
            document.getElementById("session_panel_save_btn").classList.add("disabled")

            if (this.onCancel != undefined) {
                this.onCancel()
            }
        }

        this.div.getElementById("session_panel_save_btn").onclick = () => {
            // disable the buttons.
            document.getElementById("session_panel_cancel_btn").classList.add("disabled")
            document.getElementById("session_panel_save_btn").classList.add("disabled")

            // Call save action.
            if (this.onSave != undefined) {
                this.onSave(this.firstName_, this.lastName_, this.email_, this.profilPicture_)
            }
        }

        ///////////////////////////////////////////////////////////////////////////////
        // Image selection
        ///////////////////////////////////////////////////////////////////////////////
        this.div.getElementById("profil_picture").onclick = ()=>{
            document.getElementById("profil_picture_selector").click()
        }

    }

    ///////////////////////////////////////////////////////////////////////////////////
    // Getter / Setter
    ///////////////////////////////////////////////////////////////////////////////////
    get name(): string{
        return this.name_
    }

    get firstName(): string{
        return this.firstName_
    }

    set firstName(val: string){
        this.firstName_ = val;
    }

    get lastName(): string{
        return this.firstName_
    }

    set lastName(val: string){
        this.lastName_ = val;
    }

    get emailName(): string{
        return this.email_
    }

    set emailName(val: string){
        this.email_ = val;
    }

    
    get profilPicture(): string{
        return this.profilPicture_
    }

    set profilPicture(val: string){
        this.profilPicture_ = val;
    }

    /**
     * Return the html div.
     */
    get element(): any {
        return this.div
    }
}