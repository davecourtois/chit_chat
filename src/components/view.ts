import { Model } from "../model";
import { isString, isObject } from "../utility";

export class View {
 protected model:Model;

  constructor(model: Model){
    this.model = model;
    this.model.setView(this);
  }

  /**
   * Display a message to the user.
   * @param msg The message to display in toast!
   */
  displayMessage(msg: any, duration?: number): M.Toast{
    console.log(msg)
    if(isString(msg)){

      return M.toast({ html: msg, displayLength: duration });
    }else{
      if(isObject(msg)){

      }
    }
  }

}
