import { createClient } from "@supabase/supabase-js";

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const districts = ["ঢাকা", "চট্টগ্রাম", "রাজশাহী", "খুলনা", "সিলেট", "বরিশাল", "রংপুর", "ময়মনসিংহ"];
const banglaDigits = new Intl.NumberFormat("bn-BD");
const config = {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY
};
const configured = Boolean(config.url && config.key && !config.url.includes("YOUR_PROJECT_ID") && !config.key.includes("YOUR_SUPABASE"));
const supabase = configured ? createClient(config.url, config.key) : null;

const donorList = document.querySelector("#donor-list");
const requestList = document.querySelector("#request-list");
const donorCount = document.querySelector("#donor-count");
const searchForm = document.querySelector("#search-form");
const availableOnly = document.querySelector("#available-only");
const requestDialog = document.querySelector("#request-dialog");
const contactDialog = document.querySelector("#contact-dialog");
const authDialog = document.querySelector("#auth-dialog");
const installButton = document.querySelector("#install-button");
const authButton = document.querySelector("#auth-button");
const signoutButton = document.querySelector("#signout-button");
const activitySection = document.querySelector("#my-activity");
const activityList = document.querySelector("#activity-list");
let currentUser = null;
let pendingInstallPrompt;
let authMode = "signin";

function fillOptions(select, values) {
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

document.querySelectorAll('select[name="blood"], #search-blood').forEach((select) => fillOptions(select, bloodGroups));
document.querySelectorAll('select[name="district"], #search-district').forEach((select) => fillOptions(select, districts));

function setStatus(message, isError = false) {
  const status = document.querySelector("#app-status");
  status.textContent = message;
  status.hidden = !message;
  status.classList.toggle("error", isError);
}

function showFormMessage(id, message, isError = false) {
  const element = document.querySelector(`#${id}`);
  element.textContent = message;
  element.classList.toggle("error-text", isError);
}

function requireLogin() {
  if (currentUser) return true;
  setStatus("এই কাজের জন্য আগে লগইন বা অ্যাকাউন্ট তৈরি করতে হবে।");
  showAuthDialog("signin");
  return false;
}

function showAuthDialog(mode = "signin") {
  authMode = mode;
  document.querySelector("#auth-title").textContent = mode === "signup" ? "অ্যাকাউন্ট তৈরি করুন" : "লগইন করুন";
  document.querySelector("#auth-submit").textContent = mode === "signup" ? "সাইন আপ" : "লগইন";
  document.querySelector("#auth-mode-toggle").textContent = mode === "signup" ? "আগে থেকেই অ্যাকাউন্ট আছে? লগইন করুন" : "নতুন অ্যাকাউন্ট খুলুন";
  document.querySelector('#auth-form [name="password"]').autocomplete = mode === "signup" ? "new-password" : "current-password";
  showFormMessage("auth-message", "");
  if (!authDialog.open) authDialog.showModal();
}

function formatRequestTime(value) {
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function addEmptyState(container, message) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = message;
  container.append(empty);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

async function loadDonors() {
  if (!configured) {
    donorCount.textContent = banglaDigits.format(0);
    donorList.replaceChildren();
    addEmptyState(donorList, "ডোনার ডেটাবেস সেটআপ হলে এখানে সম্মতিদানকারী ডোনার দেখা যাবে।");
    return;
  }

  const blood = document.querySelector("#search-blood").value;
  const district = document.querySelector("#search-district").value;
  const area = document.querySelector("#search-area").value.trim().toLocaleLowerCase();
  let query = supabase
    .from("donor_profiles")
    .select("user_id, display_name, blood_group, district, area, available")
    .eq("public_listing", true)
    .order("created_at", { ascending: false })
    .limit(100);

  if (blood) query = query.eq("blood_group", blood);
  if (district) query = query.eq("district", district);
  const { data, error } = await query;
  if (error) {
    setStatus(`ডোনার তালিকা লোড করা যায়নি: ${error.message}`, true);
    return;
  }

  const donors = (data || []).filter((donor) => {
    const matchesArea = !area || donor.area.toLocaleLowerCase().includes(area);
    const matchesAvailability = !availableOnly.checked || donor.available;
    return matchesArea && matchesAvailability;
  });
  donorCount.textContent = banglaDigits.format(donors.length);
  donorList.replaceChildren();

  if (!donors.length) {
    addEmptyState(donorList, "এই ফিল্টারে কোনো সম্মতিদানকারী ডোনার পাওয়া যায়নি। অন্য এলাকা বা রক্তের গ্রুপ দিয়ে চেষ্টা করুন।");
    return;
  }

  donors.forEach((donor) => {
    const card = makeElement("article", "donor-card");
    const top = makeElement("div", "donor-top");
    const avatar = makeElement("span", "donor-avatar", donor.display_name.slice(0, 1));
    avatar.setAttribute("aria-hidden", "true");
    const details = makeElement("div");
    details.append(
      makeElement("h3", "donor-name", donor.display_name),
      makeElement("p", "donor-location", `${donor.area}, ${donor.district}`)
    );
    const blood = makeElement("span", "blood-tag", donor.blood_group);
    blood.setAttribute("aria-label", `রক্তের গ্রুপ ${donor.blood_group}`);
    top.append(avatar, details, blood);

    const bottom = makeElement("div", "donor-bottom");
    const status = makeElement("span", donor.available ? "status" : "status unavailable", donor.available ? "এখন আগ্রহী" : "এই মুহূর্তে অনুপলভ্য");
    const contact = makeElement("button", "contact-button", "যোগাযোগের অনুরোধ");
    contact.type = "button";
    contact.disabled = !donor.available || donor.user_id === currentUser?.id;
    contact.addEventListener("click", () => sendContactRequest(donor));
    bottom.append(status, contact);
    card.append(top, bottom);
    donorList.append(card);
  });
}

async function loadRequests() {
  if (!configured) {
    requestList.replaceChildren();
    addEmptyState(requestList, "রক্তের অনুরোধ দেখতে বা প্রকাশ করতে database সেটআপ প্রয়োজন।");
    return;
  }

  const { data, error } = await supabase
    .from("blood_requests")
    .select("id, requester_id, blood_group, units, district, area, needed_at, status")
    .eq("status", "active")
    .gt("needed_at", new Date().toISOString())
    .order("needed_at", { ascending: true })
    .limit(50);

  if (error) {
    setStatus(`রক্তের অনুরোধ লোড করা যায়নি: ${error.message}`, true);
    return;
  }

  requestList.replaceChildren();
  if (!data?.length) {
    addEmptyState(requestList, "এখনো কোনো সক্রিয় রক্তের অনুরোধ নেই।");
    return;
  }

  data.forEach((request) => {
    const card = makeElement("article", "request-card");
    const top = makeElement("div", "request-card-top");
    const title = makeElement("h3", "", `${request.blood_group} রক্ত প্রয়োজন`);
    const urgency = makeElement(
      "span",
      "urgency",
      new Date(request.needed_at).getTime() - Date.now() < 24 * 60 * 60 * 1000 ? "জরুরি" : "অনুরোধ"
    );
    top.append(title, urgency);
    card.append(
      top,
      makeElement("p", "", `${request.area}, ${request.district}`),
    );
    const meta = makeElement("div", "request-meta");
    meta.append(
      makeElement("span", "", `${banglaDigits.format(request.units)} ইউনিট`),
      makeElement("span", "", formatRequestTime(request.needed_at))
    );
    card.append(meta);
    requestList.append(card);
  });
}

async function sendContactRequest(donor) {
  if (!requireLogin()) return;
  if (donor.user_id === currentUser.id) return;

  const { error } = await supabase.from("contact_requests").insert({
    requester_id: currentUser.id,
    donor_id: donor.user_id
  });

  const copy = document.querySelector("#contact-copy");
  if (error) {
    copy.textContent = error.code === "23505"
      ? "এই ডোনারের কাছে আগে থেকেই একটি অনুরোধ আছে। আপনার অ্যাকাউন্টের যোগাযোগ তালিকা দেখুন।"
      : `যোগাযোগের অনুরোধ পাঠানো যায়নি: ${error.message}`;
  } else {
    copy.textContent = `${donor.display_name}-এর কাছে অনুরোধ পাঠানো হয়েছে। তিনি গ্রহণ করলে তাঁর ফোন নম্বর শুধু আপনার অ্যাকাউন্টে দেখা যাবে।`;
  }
  contactDialog.showModal();
  if (!error) await loadActivity();
}

async function loadActivity() {
  if (!configured || !currentUser) {
    activitySection.hidden = true;
    return;
  }

  const [incomingResult, outgoingResult] = await Promise.all([
    supabase.from("contact_requests").select("id, requester_id, donor_id, status, created_at")
      .eq("donor_id", currentUser.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("contact_requests").select("id, requester_id, donor_id, status, created_at")
      .eq("requester_id", currentUser.id).order("created_at", { ascending: false }).limit(50)
  ]);
  if (incomingResult.error || outgoingResult.error) {
    const error = incomingResult.error || outgoingResult.error;
    setStatus(`যোগাযোগের অনুরোধ লোড করা যায়নি: ${error.message}`, true);
    return;
  }

  const outgoing = outgoingResult.data || [];
  const acceptedDonorIds = outgoing.filter((item) => item.status === "accepted").map((item) => item.donor_id);
  const donorIds = [...new Set(outgoing.map((item) => item.donor_id))];
  const [phoneResult, profilesResult] = await Promise.all([
    acceptedDonorIds.length
      ? supabase.from("donor_private").select("user_id, phone").in("user_id", acceptedDonorIds)
      : Promise.resolve({ data: [], error: null }),
    donorIds.length
      ? supabase.from("donor_profiles").select("user_id, display_name").in("user_id", donorIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (phoneResult.error || profilesResult.error) {
    const error = phoneResult.error || profilesResult.error;
    setStatus(`যোগাযোগের তথ্য লোড করা যায়নি: ${error.message}`, true);
    return;
  }

  const phones = new Map((phoneResult.data || []).map((item) => [item.user_id, item.phone]));
  const names = new Map((profilesResult.data || []).map((item) => [item.user_id, item.display_name]));
  activityList.replaceChildren();
  const incoming = incomingResult.data || [];
  if (!incoming.length && !outgoing.length) addEmptyState(activityList, "এখনো কোনো যোগাযোগের অনুরোধ নেই।");
  incoming.forEach((item) => renderIncomingContact(item));
  outgoing.forEach((item) => renderOutgoingContact(item, phones.get(item.donor_id), names.get(item.donor_id)));
  activitySection.hidden = false;
}

function renderIncomingContact(item) {
  const card = makeElement("article", "activity-card");
  card.append(
    makeElement("h3", "", "আপনার কাছে যোগাযোগের অনুরোধ"),
    makeElement("p", "", `পাঠানো হয়েছে ${formatRequestTime(item.created_at)}। আপনার সম্মতি ছাড়া ফোন নম্বর প্রকাশ হবে না.`)
  );
  const actions = makeElement("div", "activity-actions");
  if (item.status === "pending") {
    const accept = makeElement("button", "contact-button", "গ্রহণ করুন");
    accept.type = "button";
    accept.addEventListener("click", () => updateContactStatus(item.id, "accepted"));
    const decline = makeElement("button", "activity-decline", "প্রত্যাখ্যান");
    decline.type = "button";
    decline.addEventListener("click", () => updateContactStatus(item.id, "declined"));
    actions.append(accept, decline);
  } else {
    actions.append(makeElement("span", "status", item.status === "accepted" ? "আপনি গ্রহণ করেছেন" : "প্রত্যাখ্যান করা হয়েছে"));
  }
  card.append(actions);
  activityList.append(card);
}

function renderOutgoingContact(item, phone, donorName) {
  const card = makeElement("article", "activity-card");
  const title = item.status === "accepted"
    ? `${donorName || "ডোনার"} যোগাযোগের অনুরোধ গ্রহণ করেছেন`
    : item.status === "declined"
      ? `${donorName || "ডোনার"} অনুরোধটি গ্রহণ করেননি`
      : `${donorName || "ডোনার"}-এর কাছে অনুরোধ পাঠানো হয়েছে`;
  card.append(makeElement("h3", "", title));
  if (item.status === "accepted" && phone) {
    card.append(makeElement("p", "", "ডোনারের সম্মতিতে ফোন নম্বরটি দেখানো হচ্ছে।"));
    const call = makeElement("a", "activity-link", `কল করুন: ${phone}`);
    call.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
    card.append(call);
  } else if (item.status === "accepted") {
    card.append(makeElement("p", "", "ডোনার তাঁর প্রোফাইল লুকিয়েছেন; তাই যোগাযোগের নম্বর আর দেখানো হচ্ছে না।"));
  } else {
    card.append(makeElement("p", "", "ডোনার অনুরোধ গ্রহণ না করা পর্যন্ত ফোন নম্বর গোপন থাকবে।"));
  }
  activityList.append(card);
}

async function updateContactStatus(id, status) {
  const { error } = await supabase.from("contact_requests").update({ status }).eq("id", id);
  if (error) {
    setStatus(`অনুরোধের অবস্থা বদলানো যায়নি: ${error.message}`, true);
    return;
  }
  await loadActivity();
}

async function refreshSession(session) {
  currentUser = session?.user || null;
  authButton.hidden = Boolean(currentUser);
  signoutButton.hidden = !currentUser;
  activitySection.hidden = !currentUser;
  if (currentUser) {
    authButton.textContent = "অ্যাকাউন্ট";
    await loadDonorProfile();
  } else {
    authButton.textContent = "লগইন / সাইন আপ";
    document.querySelector("#donor-form").reset();
    document.querySelector("#hide-profile-button").hidden = true;
  }
  await Promise.all([loadDonors(), loadRequests(), loadActivity()]);
}

async function loadDonorProfile() {
  if (!currentUser) return;
  const [{ data: profile, error: profileError }, { data: privateInfo, error: privateError }] = await Promise.all([
    supabase.from("donor_profiles").select("*").eq("user_id", currentUser.id).maybeSingle(),
    supabase.from("donor_private").select("phone").eq("user_id", currentUser.id).maybeSingle()
  ]);
  if (profileError || privateError) {
    const error = profileError || privateError;
    setStatus(`নিজের donor profile লোড করা যায়নি: ${error.message}`, true);
    return;
  }
  const form = document.querySelector("#donor-form");
  document.querySelector("#hide-profile-button").hidden = !profile;
  if (!profile) {
    form.reset();
    return;
  }

  form.elements.name.value = profile.display_name;
  form.elements.blood.value = profile.blood_group;
  form.elements.district.value = profile.district;
  form.elements.area.value = profile.area;
  form.elements.phone.value = privateInfo?.phone || "";
  form.elements.available.checked = profile.available;
  form.elements.consent.checked = profile.public_listing;
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void loadDonors();
});
availableOnly.addEventListener("change", () => void loadDonors());
document.querySelector("#search-blood").addEventListener("change", () => void loadDonors());
document.querySelector("#search-district").addEventListener("change", () => void loadDonors());
document.querySelector("#search-area").addEventListener("input", () => void loadDonors());

document.querySelectorAll("[data-open-request]").forEach((button) => {
  button.addEventListener("click", () => {
    if (requireLogin()) requestDialog.showModal();
  });
});
document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelector("#donor-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity() || !requireLogin()) return;

  const data = new FormData(form);
  const profile = {
    user_id: currentUser.id,
    display_name: String(data.get("name")).trim(),
    blood_group: String(data.get("blood")),
    district: String(data.get("district")),
    area: String(data.get("area")).trim(),
    available: data.has("available"),
    public_listing: data.has("consent"),
    updated_at: new Date().toISOString()
  };
  if (!profile.public_listing) {
    showFormMessage("donor-message", "তালিকায় দেখাতে সম্মতি দিতে হবে। পরে profile settings-এ লুকানোর সুবিধা থাকবে।", true);
    return;
  }

  const { error: phoneError } = await supabase.from("donor_private").upsert({
    user_id: currentUser.id,
    phone: String(data.get("phone")).trim(),
    updated_at: new Date().toISOString()
  });
  if (phoneError) {
    showFormMessage("donor-message", `ব্যক্তিগত ফোন নম্বর সংরক্ষণ করা যায়নি: ${phoneError.message}`, true);
    return;
  }
  const { error: profileError } = await supabase.from("donor_profiles").upsert(profile);
  if (profileError) {
    showFormMessage("donor-message", `ডোনার প্রোফাইল সংরক্ষণ করা যায়নি: ${profileError.message}`, true);
    return;
  }

  showFormMessage("donor-message", "প্রোফাইল সংরক্ষিত। ফোন নম্বর private থাকবে এবং donor contact request গ্রহণ করলে তবেই দেখা যাবে।");
  await loadDonors();
  document.querySelector("#search").scrollIntoView({ behavior: "smooth" });
});

document.querySelector("#hide-profile-button").addEventListener("click", async () => {
  if (!currentUser) return;
  const { error } = await supabase.from("donor_profiles")
    .update({ public_listing: false, available: false, updated_at: new Date().toISOString() })
    .eq("user_id", currentUser.id);
  if (error) {
    showFormMessage("donor-message", `প্রোফাইল লুকানো যায়নি: ${error.message}`, true);
    return;
  }
  document.querySelector("#donor-form").elements.consent.checked = false;
  showFormMessage("donor-message", "প্রোফাইল donor search থেকে লুকানো হয়েছে। যোগাযোগের অনুরোধও আর পাঠানো যাবে না।");
  await loadDonors();
});

document.querySelector("#request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity() || !requireLogin()) return;

  const data = new FormData(form);
  const neededAt = new Date(String(data.get("needed")));
  if (Number.isNaN(neededAt.getTime()) || neededAt <= new Date()) {
    showFormMessage("request-message", "ভবিষ্যতের একটি সময় বেছে নিন।", true);
    return;
  }

  const { error } = await supabase.from("blood_requests").insert({
    requester_id: currentUser.id,
    blood_group: String(data.get("blood")),
    units: Number(data.get("units")),
    district: String(data.get("district")),
    area: String(data.get("area")).trim(),
    needed_at: neededAt.toISOString()
  });
  if (error) {
    showFormMessage("request-message", `অনুরোধ প্রকাশ করা যায়নি: ${error.message}`, true);
    return;
  }

  form.reset();
  showFormMessage("request-message", "অনুরোধ প্রকাশিত হয়েছে।");
  await loadRequests();
  window.setTimeout(() => {
    requestDialog.close();
    document.querySelector("#requests").scrollIntoView({ behavior: "smooth" });
  }, 700);
});

authButton.addEventListener("click", () => {
  if (currentUser) {
    document.querySelector("#my-activity").scrollIntoView({ behavior: "smooth" });
    return;
  }
  showAuthDialog("signin");
});

signoutButton.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) setStatus(`লগআউট করা যায়নি: ${error.message}`, true);
  else setStatus("");
});

document.querySelector("#auth-mode-toggle").addEventListener("click", () => {
  showAuthDialog(authMode === "signin" ? "signup" : "signin");
});

document.querySelector("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  if (!configured) {
    showFormMessage("auth-message", "Supabase সেটআপ করা হয়নি। README-এর setup ধাপ অনুসরণ করো।", true);
    return;
  }

  const data = new FormData(form);
  const email = String(data.get("email")).trim();
  const password = String(data.get("password"));
  const result = authMode === "signup"
    ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
    : await supabase.auth.signInWithPassword({ email, password });
  if (result.error) {
    showFormMessage("auth-message", `অ্যাকাউন্টে প্রবেশ করা যায়নি: ${result.error.message}`, true);
    return;
  }

  if (authMode === "signup" && !result.data.session) {
    showFormMessage("auth-message", "ইমেইলে confirmation link পাঠানো হয়েছে। link খুলে নিশ্চিত করে তারপর লগইন করো।");
    return;
  }
  form.reset();
  authDialog.close();
  setStatus("");
});

document.querySelectorAll("[data-open-request]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.querySelector('#request-form [name="needed"]');
    const minimum = new Date(Date.now() + 60 * 60 * 1000);
    input.min = new Date(minimum.getTime() - minimum.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  pendingInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!pendingInstallPrompt) return;
  await pendingInstallPrompt.prompt();
  await pendingInstallPrompt.userChoice;
  pendingInstallPrompt = undefined;
  installButton.hidden = true;
});

window.addEventListener("appinstalled", () => {
  pendingInstallPrompt = undefined;
  installButton.hidden = true;
});

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
      setStatus("Offline app cache চালু করা যায়নি। অনলাইন ব্যবহারে সমস্যা নেই।", true);
    });
  });
}

async function initialize() {
  if (!configured) {
    setStatus("সাইটের UI চলছে, কিন্তু এখনো backend যুক্ত হয়নি। বাস্তব account, donor বা request ব্যবহারের আগে README-এর Supabase setup সম্পন্ন করো।");
    await Promise.all([loadDonors(), loadRequests()]);
    activitySection.hidden = true;
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setStatus(`লগইন অবস্থা যাচাই করা যায়নি: ${error.message}`, true);
    return;
  }
  await refreshSession(data.session);
  supabase.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => void refreshSession(session), 0);
  });
}

void initialize();
