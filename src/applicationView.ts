import { Room, RoomType, RoomView } from "./room";
import { Account } from "./account";
import * as M from "materialize-css";
import "materialize-css/sass/materialize.scss";
import "../css/application.css";

// Components
import { RegisterPanel } from "./components/register";
import { LoginPanel } from "./components/login";
import { SessionPanel } from "./components/sessionPanel";
import { AccountPanel } from "./components/accountPanel";
import { ApplicationModel } from "./applicationModel";
import { randomUUID, randomIntFromInterval } from "./utility";
import { View } from "./components/view";
import { Model } from "./model";
import { SearchBox } from "./search";

/**
 * The main user interface.
 */
export class ApplicationView extends View {
    // reference to the underlying mode.
    protected model: ApplicationModel;

    // The refresh room channel.
    private refresh_rooms_listeners: Map<string, string>;
    private delete_room_listener: string;

    // The seach box.
    private searchBox: SearchBox;

    constructor(model: ApplicationModel) {
        // call the view constructor here.
        super(model);

        Model.eventHub.subscribe("delete_room_channel",
            (uuid: string) => {
                this.delete_room_listener = uuid;
            },
            (roomId: string) => {
                // disconnect event listners.
                Model.eventHub.unSubscribe("delete_room_channel", this.delete_room_listener);
                Model.eventHub.unSubscribe("refresh_rooms_channel", this.refresh_rooms_listeners.get(roomId));

                // I will leave the room...
                if (this.model.room.name == roomId) {
                    this.model.room.leave(this.model.account)
                }

                // I will remove the side menu
                let roomSideMenu = document.getElementById(roomId + "_side_menu");
                if (roomSideMenu != undefined) {
                    roomSideMenu.parentNode.removeChild(roomSideMenu)
                }

                this.displayMessage("The room " + roomId + " was deleted!", 3000)


            }, true)

        // keep the map of the refresh room listeners...
        this.refresh_rooms_listeners = new Map<string, string>();

        // The basic layout.
        document.body.innerHTML = `    
        <input type="file" id="profil_picture_selector" style="display: none;"/>
        <header id="header">
            <ul id="main_sidenav" class="sidenav sidenav-fixed" style="display: none">
            
            </ul>
        </header>

        <main>
            <div id="main" class="section no-pad-bot">
                <div id="workspace" class="container"></div>
            </div>
        </main>
        `;

        // The navigation bar at top of the application...
        let navBarCode = `
        <div class="navbar-fixed">
            <nav id="main_nav">
                <div class="nav-wrapper indigo darken-4" style="display: flex;">
                    <!--  Side menu button  -->
                    <a id="main_sidenav_lnk" href="javascript:void(0)" data-target="main_sidenav" class="sidenav-trigger" style="display: none"><i class="material-icons">menu</i></a>

                    <!-- Applicaiton logo -->
                    <a id="application_logo" href="javascript:void(0)" class="" style="padding-left: 20px;display: flex; align-self: center;"><img width="24" src="img/speech-bubbles.svg"></img></a>
                    
                    <div id="main_search_div" style="flex-grow: 1; display: flex; justify-content: flex-end;"></div>
                    
                    <!-- Medium and Up navigation menu  this is a comment-->
                    <ul id="nav-mobile" class="right hide-on-med-and-down">
                        <li id="register_lnk_0"><a class="waves-effect waves-indigo" href="javascript:void(0)">REGISTER</a></li>
                        <li id="login_lnk_0"><a class="waves-effect waves-indigo" href="javascript:void(0)">LOGIN</a></li>
                        <li id="logout_lnk_0" style="display: none"><a class="waves-effect waves-indigo" href="javascript:void(0)">LOGOUT</a></li>
                    </ul>
            
                    <!-- Small navigation menu -->
                    <a class='right dropdown-trigger hide-on-large-only' href='#' data-target='nav-mobile-dropdown'>
                        <i class="material-icons">arrow_drop_down</i>
                    </a>

                    <ul id='nav-mobile-dropdown' class='dropdown-content'">
                        <li id="register_lnk_1"><a class="waves-effect waves-indigo" href="javascript:void(0)">REGISTER</a></li>
                        <li id="login_lnk_1"><a class="waves-effect waves-indigo" href="javascript:void(0)">LOGIN</a></li>
                        <li id="logout_lnk_1" style="display: none"><a class="waves-effect waves-indigo" href="javascript:void(0)">LOGOUT</a></li>
                    </ul>
                </div>
            </nav>
        </div>
        `;

        // Append the navbar to the applicaiton interface.
        let navBar = document.createRange().createContextualFragment(navBarCode);
        document.getElementById("header").appendChild(navBar);

        // Initialyse materialyze component

        // Set the side nav.
        M.Sidenav.init(document.querySelectorAll(".sidenav"), {
            inDuration: 350,
            outDuration: 350,
            edge: "left" //or right
        });

        // Set drop-downs
        M.Dropdown.init(document.querySelectorAll(".dropdown-trigger"), {
            constrainWidth: false
        });

        // Set the media image
        M.Materialbox.init(document.querySelectorAll(".materialboxed"));

        // Set the search bar.
        let searchBarDiv = document.getElementById("main_search_div");
        this.searchBox = new SearchBox(searchBarDiv)

        // Connect user interface events.

        // The register button.
        document.getElementById("register_lnk_0").onclick = document.getElementById(
            "register_lnk_1"
        ).onclick = () => {
            document.getElementsByTagName(
                "main"
            )[0].innerHTML = `<div id="main" class="section no-pad-bot"><div id="workspace" class="container"></div></main>`;

            let registerPanel = new RegisterPanel();
            document
                .getElementById("main")
                .parentNode.appendChild(registerPanel.element);
            registerPanel.focus();

            // Set the login action handler.
            registerPanel.onLoginHandler = () => {
                document.getElementById("login_lnk_0").click();
            };

            // Now the register action.
            registerPanel.onRegisterHandler = () => {
                // Register a new account.
                this.model.register(
                    registerPanel.userName,
                    registerPanel.email,
                    registerPanel.password,
                    registerPanel.confirmPassword,
                    (account: Account) => {
                        this.openSession(account);
                    },
                    (err: any) => {
                        this.displayMessage(err, 2000);
                    }
                );
            };
        };

        // The login button.
        document.getElementById("login_lnk_0").onclick = document.getElementById(
            "login_lnk_1"
        ).onclick = () => {
            document.getElementsByTagName(
                "main"
            )[0].innerHTML = `<div id="main" class="section no-pad-bot"><div id="workspace" class="container"></div></main>`;

            let loginPanel = new LoginPanel();
            document
                .getElementById("main")
                .parentNode.appendChild(loginPanel.element);
            loginPanel.focus();

            // Set the register action handler.
            loginPanel.onRegisterHandler = () => {
                document.getElementById("register_lnk_0").click();
            };

            loginPanel.onLoginHandler = () => {
                this.model.login(
                    loginPanel.email,
                    loginPanel.password,
                    (account: Account) => {
                        this.openSession(account);
                    },
                    (err: any) => {
                        this.displayMessage(err, 2000);
                    }
                );
            };
        };

        // The logout button.
        document.getElementById("logout_lnk_0").onclick = document.getElementById(
            "logout_lnk_1"
        ).onclick = () => {
            this.model.logout();
        };
    }

    /**
     * That function is use to diplay the room creation dialog.
     */
    displayCreateRoomDialog() {
        // Set the contact interfaces.
        if (document.getElementById("create_room_form") == undefined) {
            let html = `
            <div id="create_room_form">
                <div>
                    <div class="row" style="display: flex; align-items: baseline;">
                        <div class="col s4">Room Name:</div>
                        <input class="col s8 white-text" id="room_name_input" type="text"/>       
                    </div>
                    <div class="row" style="display: flex; align-items: baseline;">
                        <div class="col s4">Subject(s):</div>
                        <input class="col s8 white-text" id="room_subject_input" type="text"/>       
                    </div>
                    <div class="row" style="display: flex;align-items: baseline;">
                        <div class="col s4">Room type:</div>
                        <div class="col s8">
                            <p>
                                <label>
                                <input id="room_type_public" name="group1" type="radio" checked />
                                <span>Public</span>
                                </label>
                            </p>
                            <p>
                                <label>
                                <input name="group1" type="radio"  />
                                <span>Private</span>
                                </label>
                            </p>
                        </div>
                    </div>
                </div>
                <div style="display: flex; padding: 10px; justify-content: flex-end;">
                    <a id="room_cancel_btn" href="javascript:void(0)">Cancel</a>
                    <a id="room_create_btn" style="padding-left: 10px;" href="javascript:void(0)">Create</a>        
                </div>
            </div>
            `;

            let msgBox = this.displayMessage(html)

            // room name input.
            document.getElementById("room_name_input").focus()

            // set the action here.
            let room_create_btn = document.getElementById("room_create_btn");
            room_create_btn.onclick = () => {
                let roomName = (<any>document.getElementById("room_name_input")).value;
                let roomSubject = (<any>document.getElementById("room_subject_input"))
                    .value;
                let roomType = (<any>document.getElementById("room_type_public")).checked;

                if (roomType) {
                    this.model.createRoom(
                        roomName,
                        roomSubject,
                        RoomType.Public
                    );
                } else {
                    this.model.createRoom(
                        roomName,
                        roomSubject,
                        RoomType.Private
                    );
                }

                msgBox.dismiss()
            };

            let room_cancel_btn = document.getElementById("room_cancel_btn");
            room_cancel_btn.onclick = () => {
                msgBox.dismiss()
            }
        }
    }

    /**
     * Display the contact creation dialog.
     */
    displayCreateContactDialog(){
        if (document.getElementById("new_contact_dialog") == undefined) {
            let html = `
            <div id="new_contact_dialog">
                <div>
                    <p>Enter the name or the email of contact to add</p>
                    <input id="new_contact_input" type="text" class="white-text"></input>
                </div>
                <div style="display: flex; padding: 10px; justify-content: flex-end;">
                    <a href="javascript:void(0)" id="new_contact_cancel_btn">Cancel</a>
                    <a href="javascript:void(0)" id="new_contact_invite_btn" style="padding-left: 10px;">Invite</a>
                </div>
            </div>
            `
            // append the 
            let msgBox = this.displayMessage(html)
            let newContactInput = document.getElementById("new_contact_input")
            newContactInput.focus()

            let newContactCancelBtn = document.getElementById("new_contact_cancel_btn")
            newContactCancelBtn.onclick = () => {
                msgBox.dismiss();
            }

            let newContactInviteBtn = document.getElementById("new_contact_invite_btn")
            newContactInviteBtn.onclick = () => {
                let contact = (<any>newContactInput).value;
                console.log(contact)
                msgBox.dismiss();
            }
        }
    }
    /**
     * Open a new session.
     */
    openSession(account: Account) {
        this.displayMessage("Welcome to chitchat " + account.name + "!", 2000);

        // hide register and login menu
        document.getElementById("login_lnk_0").style.display = "none";
        document.getElementById("login_lnk_1").style.display = "none";
        document.getElementById("register_lnk_0").style.display = "none";
        document.getElementById("register_lnk_1").style.display = "none";

        // show the search bar...
        this.searchBox.show()

        // hide the icon.
        document.getElementById("application_logo").style.display = "none";

        // display logout menu.
        document.getElementById("logout_lnk_0").style.display = "";
        document.getElementById("logout_lnk_1").style.display = "";

        // display the sidenave menu
        document.getElementById("main_sidenav").style.display = "";
        document.getElementById("main_sidenav_lnk").style.display = "";

        // Clear the main panel.
        document.getElementsByTagName(
            "main"
        )[0].innerHTML = `<div id="main" class="section no-pad-bot"><div id="workspace" class="container"></div></main>`;

        // Clear the sidenav bar.
        document.getElementById("main_sidenav").innerHTML = "";

        // The session specific menu.
        let sidenav = document.getElementById("main_sidenav");

        // append the session state panel.
        let sessionPanel = new SessionPanel(
            this.model.account.name,
            this.model.account.profilPicture
        );
        sidenav.appendChild(sessionPanel.element);

        sessionPanel.setSessionName(account.name);

        let elements = document.createRange().createContextualFragment(`
        <li>
            <a style="padding: 0 16px;" class="waves-effect waves-teal">
                <div style="display:flex;">
                    <span style="flex-grow: 1;" tile="Discutions you have created">My Discutions</span> 
                    <i id="add_room_btn" class="material-icons" style="align-self: center;">add_circle</i>
                </div>
            </a>
        </li>
        <li>
            <ul class="collapsible collapsible-accordion" id="roomList">
            </ul>
        </li>
        <li>
            <a style="padding: 0 16px;" class="waves-effect waves-teal">
                <div style="display:flex;">
                    <span style="flex-grow: 1;" tile="The list of your contact">My Contacts</span> 
                    <i id="add_contact_btn" class="material-icons" style="align-self: center;">add_circle</i>
                </div>
            </a>
        </li>
        <li>
            <ul class="collapsible collapsible-accordion" id="contactList">
            </ul>
        </li>
        `);

        // set the sidenave content.
        sidenav.appendChild(elements);

        /////////////////////////////////////////////////
        // session panel

        // Set the new session state.
        sessionPanel.onStateChange = (state: string) => {
            this.model.setSessionState(state);
        };

        // Display account panel to change accont setting.
        sessionPanel.onNameClick = () => {
            // Clear the workspace.
            document.getElementById("workspace").innerHTML = "";

            let accountPanel = new AccountPanel(
                this.model.account.name,
                this.model.account.firstName,
                this.model.account.lastName,
                this.model.account.email,
                this.model.account.profilPicture
            );
            document.getElementById("workspace").appendChild(accountPanel.element);

            // Here I will connect acount panel events.
            accountPanel.onSave = (
                firstName: string,
                lastName: string,
                email: string
            ) => {
                // Set the mode account properties.
                this.model.account.firstName = firstName;
                this.model.account.lastName = lastName;
                this.model.account.email = email;

                // Save the account in the user database.
                this.model.saveAccount(
                    (account: Account) => {
                        this.displayMessage(
                            "Account " + account.name + " was saved!",
                            2000
                        );
                    },
                    (err: any) => {
                        this.displayMessage(err, 2000);
                    }
                );
            };

            M.updateTextFields();
        };

        // The profile image selection.
        document.getElementById("profil_picture_selector").onchange = (
            evt: any
        ) => {
            var r = new FileReader();
            var file = evt.target.files[0];
            r.onload = () => {
                // we have the file data
                // first of all I will set the already open image with the new profil image.
                let images = document.getElementsByName("profil_picture");
                for (var i = 0; i < images.length; i++) {
                    images[i].setAttribute("src", r.result.toString());
                }

                // Save the profile picture.
                this.model.changeProfilImage(
                    r.result.toString(),
                    (account: Account) => {
                        let message = `
                            <img width=30 height=30 style="margin-right: 10px" src=${account.profilPicture}></img><span>Profile image was update<span>
                        `;
                        this.displayMessage(message, 2000);
                    },
                    (err: any) => {
                        this.displayMessage(err, 2000);
                    }
                );
            };
            r.readAsDataURL(file); // read as BASE64 format
        };

        /////////////////////////////////////////////////
        // Room creation and initialisation.

        //Connect add room action
        let add_room_btn = document.getElementById("add_room_btn");

        add_room_btn.onclick = (event: any) => {
            event.stopPropagation();
            this.displayCreateRoomDialog()
        };

        // init the rooms
        this.model.initRooms();

        /////////////////////////////////////////////////
        // Contact creation and initialisation.
        let add_contact_btn = document.getElementById("add_contact_btn");
        add_contact_btn.onclick = (event: any) => {
            event.stopPropagation();
            this.displayCreateContactDialog()
        };

        // Set drop-downs
        M.Dropdown.init(document.querySelectorAll(".dropdown-trigger"), {
            constrainWidth: false
        });

    }

    closeSession(account: Account) {
        // remove remember-me value.
        localStorage.removeItem("remember-me");

        // hide register and login menu
        document.getElementById("login_lnk_0").style.display = "";
        document.getElementById("login_lnk_1").style.display = "";
        document.getElementById("register_lnk_0").style.display = "";
        document.getElementById("register_lnk_1").style.display = "";
        // display logout menu.
        document.getElementById("logout_lnk_0").style.display = "none";
        document.getElementById("logout_lnk_1").style.display = "none";
        // display the sidenave menu
        document.getElementById("main_sidenav").style.display = "none";
        document.getElementById("main_sidenav_lnk").style.display = "none";

        // hide the search bar...
        this.searchBox.hide()

        // show the icon.
        document.getElementById("application_logo").style.display = "flex";

        // Clear the workspace.
        document.getElementById(
            "main"
        ).innerHTML = `<div id="workspace" class="container"></div>`;

        // Clear the sidenav bar.
        document.getElementById("main_sidenav").innerHTML = "";

        // Display goodbye message.
        if (account != undefined) {
            this.displayMessage("Goodbye " + account.name + " see you latter!", 2000);
        }

        // Here I will unsubscribe to room listeners.
        this.refresh_rooms_listeners.forEach(
            (uuid: string) => {
                Model.eventHub.unSubscribe("refresh_rooms_channel", uuid);
            });

        this.refresh_rooms_listeners.clear();
    }


    appendRoom(room: Room, index: number) {
        // do nothing if the side menu already exist.
        if (document.getElementById(room.name + "_side_menu") != undefined) {
            return
        }

        let roomList = document.getElementById("roomList");
        let uuid = randomUUID();
        let uuid2 = randomUUID();
        let txt = `
        <li id="${room.name + "_side_menu"}">
            <a class="collapsible-header waves-effect waves-teal" id="${uuid}" > 
                <i id="${room.id + "_join_btn"}" name="join_btn" class="material-icons" title="join the room ${room.name}" >input</i> 
                <span id="${uuid + "_count"}" class="badge">${room.participants.length.toString()}</span> ${room.name}</a>
            <div class="collapsible-body" style="">
                    <ul id=${uuid2}>
                    
                    </ul>
            </div>
        </li>
        `;

        let elements = document.createRange().createContextualFragment(txt);
        roomList.appendChild(elements);

        let participants_div = document.getElementById(uuid2);

        for (var i = 0; i < room.participants.length; i++) {
            let color = room.getParticipantColor(room.participants[i]);
            let participant_div = document.createRange().createContextualFragment(`
                    <li style="display: flex;align-items: center;">
                        <a href="javascript:void(0)" style="flex-grow: 1;">${room.participants[i]}<span class="badge"><i class="material-icons" style="color:${color};">account_circle</i></span></a>
                    </li>`);
            participants_div.appendChild(participant_div);
        }

        M.Collapsible.init(roomList);

        // Here if the participant leave or join a room I will set the number of participant.
        Model.eventHub.subscribe("refresh_rooms_channel",
            (uuid: string) => {
                // keep the listener uuid to unsubscribe latter.
                this.refresh_rooms_listeners.set(room.name, uuid);
            },
            () => {
                let badge = document.getElementById(uuid + "_count");
                badge.innerHTML = room.participants.length.toString()

                let participants_div = document.getElementById(uuid2);
                participants_div.innerHTML = ""

                for (var i = 0; i < room.participants.length; i++) {
                    let color = room.getParticipantColor(room.participants[i]);
                    let participant_div = document.createRange().createContextualFragment(
                        `<li style="display: flex;align-items: center;">
                            <a href="javascript:void(0)" style="flex-grow: 1;">${room.participants[i]}<span class="badge"><i class="material-icons" style="color:${color};">account_circle</i></span></a>
                        </li>`);
                    participants_div.appendChild(participant_div);
                }

            }, true)

        document.getElementById(uuid).onclick = (evt: any) => {
            if (this.model.room != undefined) {
                if (this.model.room.name == room.name) {
                    // Remove the actual content
                    document.getElementById("workspace").innerHTML = "";
                    // display the room content.
                    this.model.room.view.setParent(document.getElementById("workspace"))
                }
            }
        }

        let joinBtn = document.getElementById(room.id + "_join_btn");

        joinBtn.onclick = (evt: any) => {
            evt.stopPropagation();

            // clear the actual display.
            document.getElementById("workspace").innerHTML = ""

            // display all join room buttons
            let btns = document.getElementsByName("join_btn")
            btns.forEach((btn: any) => {
                btn.style.display = "";
            })

            // hide the current room
            joinBtn.style.display = "none";

            // Open the list of user in the room.
            var instance = M.Collapsible.getInstance(roomList);
            instance.open(index);

            if (this.model.room != undefined) {
                if (this.model.room.name != room.name) {
                    this.model.room.leave(this.model.account, () => {

                        // Remove the actual content
                        document.getElementById("workspace").innerHTML = "";

                        // Join the room
                        room.join(this.model.account);

                        if (room.view == undefined) {
                            new RoomView(document.getElementById("workspace"), room, index);
                        } else {
                            room.view.setParent(document.getElementById("workspace"))
                        }
                        this.model.room = room;

                    })
                }
            } else {
                // Join the room
                room.join(this.model.account);
                if (room.view == undefined) {
                    new RoomView(document.getElementById("workspace"), room, index);
                } else {
                    room.view.setParent(document.getElementById("workspace"))
                }
                this.model.room = room;
            }

        };
    }
}
