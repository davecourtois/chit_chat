import * as M from "materialize-css";
import 'materialize-css/sass/materialize.scss';
import '../../css/components/session.css'

/**
 * That class contain the code for the register panel.
 */
export class SessionPanel {
    private div: any;

    /** Action handler */
    public onStateChange: (state: string) => void
    public onNameClick: ()=>void;

    constructor(name:string, profilePicture?:string) {
        if(profilePicture == undefined){
            profilePicture = "profil.svg"
        }

        let html = `
        <div class="session-panel">
            <div class="session-info">
                <div style="display: flex; flex-direction: column; align-items: center; width: 100px;">
                    <img id="profil-img" name="profil_picture" width=32 height=32 src=${profilePicture} alt="" class="circle responsive-img">
                    <div class="session-state">
                        <span id="session-state" class="green-text">Online</span>
                        <a class='right dropdown-trigger' href='#' data-target='session-state-dropdown'><i class="material-icons">arrow_drop_down</i></a>
                        <ul id='session-state-dropdown' class='dropdown-content'">
                            <li id="online_state_lnk"><a class="waves-effect waves-indigo green-text" href="javascript:void(0)">ONLINE</a></li>
                            <li id="away_state_lnk"><a class="waves-effect waves-indigo orange-text" href="javascript:void(0)">AWAY</a></li>
                            <li id="offline_state_lnk"><a class="waves-effect waves-indigo red-text" href="javascript:void(0)">OFFLINE</a></li>
                        </ul>
                    </div>
                </div>
                <span id="session-id" class="black-text" style="font-size: 1.2rem;">${name}</span>
            </div>
        </div>
        `

        // Initialyse the html elements.
        this.div = document.createRange().createContextualFragment(html);

        this.div.getElementById("online_state_lnk").onclick = () => {
            document.getElementById("session-state").innerHTML = "ONLINE";
            document.getElementById("session-state").className = "green-text";
            if (this.onStateChange != undefined) {
                this.onStateChange("ONLINE")
            }
        }

        this.div.getElementById("away_state_lnk").onclick = () => {
            document.getElementById("session-state").innerHTML = "AWAY";
            document.getElementById("session-state").className = "orange-text";
            if (this.onStateChange != undefined) {
                this.onStateChange("AWAY")
            }
        }

        this.div.getElementById("offline_state_lnk").onclick = () => {
            document.getElementById("session-state").innerHTML = "OFFLINE";
            document.getElementById("session-state").className = "red-text";
            if (this.onStateChange != undefined) {
                this.onStateChange("OFFLINE")
            }
        }

        this.div.getElementById("profil-img").onclick = ()=>{
            document.getElementById("profil_picture_selector").click()
        }

        this.div.getElementById("session-id").onclick = ()=>{
            if(this.onNameClick != undefined){
                this.onNameClick()
            }
        }
    }

    /**
     * Return the html div.
     */
    get element(): any {
        return this.div
    }

    setSessionName(name: string) {
        document.getElementById("session-id").innerHTML = name;
    }

}