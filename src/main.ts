// todo
//add button element to web page

// Create a new button element
const button = document.createElement("button");
button.textContent = "Click Me";

// Append the button to the body of the document
document.body.appendChild(button);

//on click, display alert('you clicked the button!')
button.addEventListener("click", () => {
  alert("you clicked the button!");
});
