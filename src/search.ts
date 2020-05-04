import { randomUUID } from "./utility";
import { Model } from "./model";
import { AggregateRqst, AggregateResp, FindOneRqst, FindResp } from "globular-web-client/lib/persistence/persistencepb/persistence_pb";
import { application, domain, applicationModel } from ".";
import { RoomType, Room } from "./room";

/**
 * The search box is use to find User and Room.
 * -- In order for the search engine to work correctly you must create indexation for the data 
 *    you want to search, here is the command to run as admin in the mongo admin shell on the
 *    server side.
 *    connect on the shell
 *    mongo -u sa -p adminadmin
 *    > db=db.getSiblingDB('chitchat_db')
 *    > db.Rooms.createIndex({"name":"text", "subjects":"text", "creator":"text", "messages.from":"text", "messages.replies_.from":"text", "messages.date":1}) // append other fields as needed here...
 */
export class SearchBox {

    // Dom element
    private div: any;
    private input: any;
    private closeSearchBtn: any;

    constructor(parent: any) {
        let div_id = randomUUID()
        let input_id = randomUUID()
        let close_search_id = randomUUID()
 
        let html = `
        <div id="${div_id}" class="input-field" style="max-width: 430px; padding: 1px; display: none;">
            <input type="search" id="${input_id}" autocomplete="off" style="border: none; box-shadow:none; ">
            <label class="label-icon" for="${input_id}">
                <div style="display: flex;">
                    <i class="material-icons">search</i>
                </div>
            </label>
            <i id="${close_search_id}" class="material-icons">close</i>
        </div>
        `

        let range = document.createRange()
        let div = range.createContextualFragment(html);
        parent.appendChild(div)

        // keep reference to the doom element...
        this.div = document.getElementById(div_id);
        this.input = document.getElementById(input_id);
        this.closeSearchBtn = document.getElementById(close_search_id);

        this.closeSearchBtn.onclick = (evt:any) =>{
          this.input.value = "";
        }

        this.input.onfocus = ()=>{
            this.input.setSelectionRange(0, this.input.value.length-1)
        }

        /**
         * here the user want's to execute the search.
         */
        this.input.onkeyup = (evt: any)=>{

            // get the search result.
            if(evt.keyCode == 13){

                // Use aggreagtion to retreive existing room.
                let room_query =   `[
                  { "$match": {"$text": { "$search": "${this.input.value}" } } },
                  { "$sort": { "score": { "$meta": "textScore" } } },
                  { "$project": {"_id":"$_id", "creator":"$creator", "count":{"$size":"$messages"}, "first_date":{"$min":"$messages.date"}, "last_date":{"$max":"$messages.date" } } }
                ]`

                let rqst = new AggregateRqst
                rqst.setId("chitchat_db");
                rqst.setDatabase("chitchat_db");
                rqst.setCollection("Rooms");

                rqst.setPipeline(room_query)
 
                let stream = Model.globular.persistenceService.aggregate(rqst, {
                  token: localStorage.getItem("user_token"),
                  application: application,
                  domain: domain
                });

                // clear the workspace.
                document.getElementById("workspace").innerHTML = ""
                let div = document.createElement("div");
                document.getElementById("workspace").appendChild(div)

                stream.on("data", (rsp: AggregateResp) => {
                  let data = JSON.parse(rsp.getJsonstr())
                  // dispach the result locally...
                  for(var i=0; i < data.length; i++){
                    new RoomSearchResult(div, data[i]._id, data[i].creator, data[i].count, new Date(data[i].first_date), new Date(data[i].last_date))
                  }
                });
      
                stream.on("status", status => {
                  if (status.code != 0) {
                    console.log(status.details)
                  }
                })

                this.input.value = ""
            }

        }
    }

    show(){
        this.div.style.display = ""
    }

    hide(){
        this.div.style.display = "none"
    }
}

/**
 * Display a single room search result.
 */
class RoomSearchResult{
   
  constructor(parent:any, public name: string, public creator:string, public count:number, public created: Date, public modified: Date){
    let uuid = randomUUID();

    let html = `
      <div id="${uuid}" class="card">
        <div class="card-content">
          <span class="card-title">${name}</span>
          <div class="row">
            <div class="col s4">Created by</div> 
            <div class="col s8">${creator}</div>
          </div>
          <div class="row">
            <div class="col s4">First message received</div>
            <div class="col s8">${created.toLocaleDateString() + " " + created.toLocaleTimeString()}</div>
          </div>
          <div class="row">
            <div class="col s4">Last message received</div>
            <div class="col s8">${modified.toLocaleDateString() + " " + modified.toLocaleTimeString()}</div>
        </div>
        <div class="card-action">
          <a id="${uuid + "_lnk"}" href="javascript:void(0)" id="">Join</a>
        </div>
      <div>
    `
    let range = document.createRange()
    let div = range.createContextualFragment(html);
    parent.appendChild(div)

    let lnk = document.getElementById(uuid + "_lnk")

    // Join the room.
    lnk.onclick = ()=>{
      // first of all I will test if the room is already 

      // Get the room data
      let rqst = new FindOneRqst
      rqst.setId("chitchat_db");
      rqst.setDatabase("chitchat_db");
      rqst.setCollection("Rooms");
      rqst.setQuery(`{"_id":"${name}"}`)
      rqst.setOptions(`[{"Projection":{"messages":0}}]`)

      Model.globular.persistenceService.findOne(rqst, {
        token: localStorage.getItem("user_token"),
        application: application,
        domain: domain
      }).then((rsp:FindResp)=>{
        let room = JSON.parse(rsp.getJsonstr());
        // append it to the application 
        applicationModel.appendRoom(room, (r:Room)=>{
          // join the room
          document.getElementById(r.id + "_join_btn").click()

          // Now I will keep the room in the list of user rooms.

        },
        (err:any)=>{
          console.log(err)
        });

      }).catch((err: any) => {
        console.log(err);
      });
    }


  }
}