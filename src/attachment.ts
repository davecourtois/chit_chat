import { Model } from "./model";
import { View } from "./components/view";
import { randomUUID } from "./utility";
import { ReadDirRequest, ReadFileResponse } from "globular-web-client/lib/file/filepb/file_pb";
import { application, domain } from ".";

// Concatenate a mix of typed arrays
function concatenate(...arrays: any) {
    // Calculate byteSize from all arrays
    let size = arrays.reduce((a: any, b: any) => a + b.byteLength, 0)
    // Allcolate a new buffer
    let result = new Uint8Array(size)

    // Build the new array
    let offset = 0
    for (let arr of arrays) {
        result.set(arr, offset)
        offset += arr.byteLength
    }

    return result
}

/**
 * Display the a view of all ressource releated to a given discution
 */
export class AttachementsPanel extends View {
    // The div that contain the list of attachement.
    private div: any;
    private parent: any;
    private roomId: string;
    private uuid: string;
    private path: string;

    // Event listeners.
    private refresh_attachement_listener: string;
    private join_room_listener: string;
    private leave_room_listener: string;
    private delete_room_listener: string;

    // Attach button
    private attachBtn: any;

    constructor(parent: any, roomId: string) {
        super()

        this.parent = parent;
        this.uuid = randomUUID()
        this.path = "/uploads/chitchat/" + roomId

        let html = `
            <div id="${this.uuid}">
                <nav class="nav-wrapper indigo darken-4" style="height: 48px; display: flex; align-items: center; padding-left: 10px; padding-right: 10px; color: white;">
                    <div style="display:flex; width: 100%;">
                        <span style="flex-grow: 1;" tile="Discutions you have created">Attachements</span> 
                        <i id="${this.uuid + "_picture_btn"}" class="material-icons right" style="align-self: center;">attach_file</i>
                        <input id="file_input" type="file" name="name" multiple="true" style="display: none;" />
                    </div>
                </nav>
            </div>
        `
        let range = document.createRange();
        let div = range.createContextualFragment(html);
        parent.appendChild(div)

        // keep reference to the div.
        this.div = document.getElementById(this.uuid)
        this.attachBtn = document.getElementById(this.uuid + "_picture_btn");

        this.attachBtn.onmouseover = () => {
            this.attachBtn.style.cursor = "pointer";
        }

        this.attachBtn.onmouseleave = () => {
            this.attachBtn.style.cursor = "default";
        }


        let fileInput = document.getElementById("file_input");

        this.attachBtn.onclick = (e: any) => {
            fileInput.click()
        }

        fileInput.onchange = (e: any) => {

            let path = this.path;
            const fd = new FormData();

            // add all selected files
            for (var i = 0; i < e.target.files.length; i++) {
                let file = e.target.files[i];
                fd.append("multiplefiles", file, file.name);
                fd.append("path", path)
            }

            // create the request
            const xhr = new XMLHttpRequest();

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    // we done! I will use the rename file event to refresh the directory...
                    Model.eventHub.publish(this.roomId + "_refresh_attachment_channel", { path: this.path }, true);
                }
            };

            // path to server would be where you'd normally post the form to
            xhr.open('POST', "/uploads", true);
            xhr.setRequestHeader("token", localStorage.getItem("user_token"))
            xhr.setRequestHeader("application", "admin")
            xhr.setRequestHeader("domain", window.location.hostname)
            xhr.onerror = (err: any) => {

            }

            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {   //if complete
                    if (xhr.status === 200) {  //check if "OK" (200)
                        //success
                    } else {
                        M.toast({ html: "Permission denied to upload file " + path, displayLength: 2000 });
                    }
                }
            }

            xhr.send(fd);
        }

        // I will use event to react to action made by the user on attachement instead of 
        // references.
        Model.eventHub.subscribe(roomId + "_refresh_attachment_channel",
            (uuid: string) => {
                this.refresh_attachement_listener = uuid;
            },
            (evt: any) => {

            },
            false)

        // Connect the event listener's
        Model.eventHub.subscribe(
            roomId + "_join_room_channel",
            // On subscribe
            (uuid: string) => {
                // this.uuid = uuid;
                this.join_room_listener = uuid;

                Model.eventHub.subscribe(
                    roomId + "_leave_room_channel",
                    // On subscribe
                    (uuid: string) => {
                        this.leave_room_listener = uuid;
                        Model.eventHub.subscribe(roomId + "_delete_room_channel",
                            (uuid: string) => {
                                this.delete_room_listener = uuid
                            },
                            (roomId: string) => {
                                if (roomId == roomId) {
                                    this.onDelete()
                                }
                            }, false)
                    },
                    // On event.
                    (paticipantId: string) => {
                        this.onLeave(paticipantId)
                    },
                    false
                );
            },
            // On event.
            (paticipantId: any) => {
                this.onJoin(paticipantId)
            },
            false
        );

        // Display files from the path.
        this.displayFiles()
    }

    /**
     * I will get the list of file and display its...
     */
    displayFiles() {
        let rqst = new ReadDirRequest
        rqst.setPath(this.path)

        // I will get all infromation at once.
        rqst.setRecursive(true)
        rqst.setThumnailheight(512)
        rqst.setThumnailwidth(512)

        let stream = Model.globular.fileService.readDir(rqst, {
            token: localStorage.getItem("user_token"),
            application: application,
            domain: domain
        })

        let data = new Uint8Array()

        // Get the stream and set event on it...
        stream.on("data", (rsp: ReadFileResponse) => {
            // data = new Uint8Array([ ...data, ...rsp.getData_asU8() ]); 
            data = concatenate(data, rsp.getData_asU8())
        });

        stream.on("status", status => {
            if (status.code == 0) {
                var jsonStr = new TextDecoder("utf-8").decode(data);
                let infos = JSON.parse(jsonStr)
                console.log(infos)
                for(var i=0; i < infos.Files.length; i++){
                    this.displayFile(infos.Files[i])
                }
            }else{
                this.displayMessage(status.details, 3000)
            }
        })
    }

    /**
     * Display file info
     * @param file 
     */
    displayFile(file: any){
        console.log(file)
    }

    /**
     * Set the parent.
     */
    setParent(parent: any) {
        this.parent = parent;
        this.show()
    }

    /**
     * Remove from the dom.
     */
    hide() {
        this.parent.removeChild(this.div)
    }

    /**
     * Re-append to the dom...
     */
    show() {
        this.parent.appendChild(this.div)
    }

    /**
     * Close the panel.
     */
    close() {
        // unsubscribe to file attachement channel.
        Model.eventHub.unSubscribe(this.roomId + "_refresh_attachment_channel", this.refresh_attachement_listener)

        // disconnect the listener to display joinning user
        Model.eventHub.unSubscribe(this.roomId + "_join_room_channel", this.join_room_listener)

        // disconnect the listener to display leaving user
        Model.eventHub.unSubscribe(this.roomId + "_leave_room_channel", this.leave_room_listener)

        // disconnect the delete room channel (local event)
        Model.eventHub.unSubscribe(this.roomId + "_delete_room_channel", this.delete_room_listener)
    }

    // Event ...
    onJoin(participant: string) {
        console.log("------> on join attachement ", participant)
    }

    onLeave(participant: string) {
        console.log("------> on leave attachement ", participant)
    }

    onDelete() {
        // close listeners.
        this.close()
    }

}