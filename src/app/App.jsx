import { Card,CardContent } from "@/components/ui/card";
import "./App.css"
import { Selector } from "./selector";
function App(){
  return(

    <div className="app-body">
<div className="main_box w-full flex flex-col justify-center items-center 
">
<h2 className="text-3xl custom-font pt-9
        font-bold mb-5 text-center">
        Welcome to the Loader app
       </h2>
   <div className="
    h-[80vh] w-[80vw] p-20 ml-20 mr-20 flex-col gap-8
     flex border-gray-700 border
    ">
       <div className="UrlContainer flex flex-row ">
        <input type="text" placeholder=" Insert url here"  primary-font
         className="h-10 p-2
          w-150 border border-gray-700
        focus:outline-2 focus:border-gray-500
        "></input>
        <button className="ml-2 bg-gray-950 hover:bg-gray-900 rounded-none text-white font-bold py-2 px-4 rounded h-10">
          Fetch
        </button>
       </div>
        
        <Selector/>
        <Card className="preview-container secondary-color rounded-none h-50 flex justify-center items-center">
          <CardContent className="flex flex-col justify-center items-center">
            <h3 className="text-lg font-bold mb-2">Preview</h3>
            <p className="text-sm text-gray-600">Video preview will be displayed here.</p>
          </CardContent>
        </Card>
        
        <button className="ml-2 bg-gray-950 hover:bg-gray-900 rounded-none text-white font-bold py-2 px-4 rounded h-10">
          Download
        </button>
      </div>
</div>


    </div>
  )

}

export default App;