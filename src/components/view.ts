import { Model } from "../model";
import { isObject, isString } from "../utility";

export class View {
 protected model:Model;

  constructor(model: Model){
    this.model = model;
    this.model.setView(this);
  }

  getErrorMessage(err:any):string{
    
    try {
      let errObj = err;
      if(isString(err)){
       errObj = JSON.parse(err);
      }else if(errObj.message != undefined){
        errObj = JSON.parse(errObj.message )
      }

      if (errObj.ErrorMsg != undefined) {
        console.log(errObj)
        return errObj.ErrorMsg
      }else{
        return err
      }

    } catch{
      console.log(err)
      return err;
    }
  }

  /**
   * Display a message to the user.
   * @param msg The message to display in toast!
   */
  displayMessage(err: any, duration?: number): M.Toast{
      return M.toast({ html: this.getErrorMessage(err), displayLength: duration });
  }

}
