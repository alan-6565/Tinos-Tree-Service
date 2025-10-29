const menu = document.querySelector("#mobile-menu");
const menuLinks = document.querySelector(".navbar__menu");

menu.addEventListener("click", function () {
  menu.classList.toggle("is-active");
  menuLinks.classList.toggle("active");
});

// This function duplicates the logos to create a seamless loop
const logos = document.querySelector(".rotating-logos__track").cloneNode(true);
document.querySelector(".rotating-logos").appendChild(logos);

window.addEventListener("load", () => {
  const yearElement = document.getElementById("year");
  const currentYear = new Date().getFullYear();
  yearElement.textContent = currentYear;
});

// This function duplicates the logos to create a seamless loop
function switchPricing() {
  const checkbox = document.getElementById("pricing-toggle-checkbox");
  const monthlyPrices = document.querySelectorAll(".monthly-price");
  const yearlyPrices = document.querySelectorAll(".yearly-price");
  const yearlyDiscount = document.querySelector(".save-percentage"); // Corrected selector

  if (checkbox.checked) {
    // Show yearly prices and show the discount message
    monthlyPrices.forEach((price) => price.classList.add("hidden"));
    yearlyPrices.forEach((price) => price.classList.remove("hidden"));
    yearlyDiscount.style.display = "inline"; // Show discount when yearly is selected
  } else {
    // Show monthly prices and hide the discount message
    monthlyPrices.forEach((price) => price.classList.remove("hidden"));
    yearlyPrices.forEach((price) => price.classList.add("hidden"));
    yearlyDiscount.style.display = "none"; // Hide discount when monthly is selected
  }
}
