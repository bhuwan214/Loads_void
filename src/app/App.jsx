import "./App.css"
function App(){
  return(

    <div className="app-body">
<div className="main_box w-full flex flex-col justify-center items-center 
">
<h2 className="text-3xl custom-font pt-9
        font-bold mb-5 text-center">
        Welcome to the Loader app
       </h2>
   <div className=" bg-amber-400
    h-[80vh] w-[80vw] p-20 ml-20 mr-20
     flex rounded-lg shadow-lg
    ">
       
        <input type="text" placeholder=" Insert url here"  primary-font
         className="h-10 p-2
          w-150 border border-gray-700
        focus:outline-2 focus:border-gray-500
        rounded-md"></input>
        <button className="ml-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded h-10">
          Submit
        </button>
        
      </div>
</div>


    </div>
  )

}

export default App;