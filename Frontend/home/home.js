const tabs = document.querySelectorAll(".tab-button");
const sections = document.querySelectorAll(".form-section");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    sections.forEach((section) => {
      section.classList.remove("active");
      section.classList.add("hidden");
    });
    document.getElementById(`form-${target}`).classList.remove("hidden");
    document.getElementById(`form-${target}`).classList.add("active");
  });
});


