import { Card, CardContent } from "@/components/ui/card";
import "./App.css";
import { Selector } from "./selector";
function App() {
  return (
    <div className="app-body">
      <div
        className="main_box w-full flex flex-col justify-center items-center 
"
      >
        <h2
          className="text-3xl custom-font pt-9
        font-bold mb-5 text-center"
        >
          Welcome to the Loader app
        </h2>
        <div
          className=" w-[90vw]
    sm:w-[80vw] pt-20 px-5 h-[80vh]
      flex-col sm:gap-8 gap-6  pb-20
     flex border-gray-700 border sm:items-center 
    "
        >
          <div
            className="UrlContainer flex flex-col sm:flex-row gap-4 items-center sm:gap-5  justify-center sm:w-[50%] 
       "
          >
            <input
              type="text"
              placeholder=" Insert url here"
              primary-font
              className="h-10 p-2
          w-full
           border border-gray-700 sm:w-150
        focus:outline-2 focus:border-gray-500
        "
            ></input>
            <button
              className=" bg-gray-950 hover:bg-gray-900 rounded-none text-white font-bold py-2 px-4 h-10 w-[95%] sm:w-30
        "
            >
              Fetch
            </button>
          </div>

          <Selector />
          <Card
            className="preview-container secondary-color rounded-none aspect-video w-[90%] sm:w-[50%] mx-4
         flex justify-center items-center"
          >
            <CardContent className="flex flex-col justify-center items-center">
              <h3 className="text-lg font-bold mb-2">Preview</h3>
              <p className="text-sm text-gray-600">
                Video preview will be displayed here.
              </p>
            </CardContent>
          </Card>

          <button
            className="ml-2 bg-gray-950 hover:bg-gray-900 rounded-none text-white font-bold py-2 px-4 w-[95%] sm:w-[50%]
         h-10"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
