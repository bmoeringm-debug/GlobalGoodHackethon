const COLLEGE_CATALOG_STORAGE_KEY = "collegeMatchCatalogV1";
const SCHOOL_NOTES_STORAGE_KEY = "collegeMatchSchoolNotesV1";
const SCHOOL_WORKSPACE_STORAGE_KEY = "collegeMatchSchoolWorkspaceV1";
let currentSchoolName = "";

function money(value) {
  return typeof value === "number" ? `$${value.toLocaleString()}` : "N/A";
}

function acceptanceRate(college) {
  if (!college || !college.applications) return "N/A";
  return `${((college.accepted / college.applications) * 100).toFixed(1)}%`;
}

function getSchoolFromCatalog(name) {
  const raw = localStorage.getItem(COLLEGE_CATALOG_STORAGE_KEY);
  if (!raw) return null;
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return null;
    return list.find((c) => c.name === name) || null;
  } catch (error) {
    return null;
  }
}

function getSchoolNote(name) {
  const raw = localStorage.getItem(SCHOOL_NOTES_STORAGE_KEY);
  if (!raw) return "";
  try {
    const notes = JSON.parse(raw);
    return notes && typeof notes === "object" ? (notes[name] || "") : "";
  } catch (error) {
    return "";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAllSchoolNotes() {
  const raw = localStorage.getItem(SCHOOL_NOTES_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function normalizeSchoolNoteEntry(entry) {
  if (typeof entry === "string") {
    return { text: entry, files: [] };
  }
  if (!entry || typeof entry !== "object") {
    return { text: "", files: [] };
  }
  return {
    text: typeof entry.text === "string" ? entry.text : "",
    files: Array.isArray(entry.files) ? entry.files : []
  };
}

function saveSchoolNoteData(name, noteData) {
  const notes = getAllSchoolNotes();
  notes[name] = normalizeSchoolNoteEntry(noteData);
  localStorage.setItem(SCHOOL_NOTES_STORAGE_KEY, JSON.stringify(notes));
}

function getSchoolNoteData(name) {
  const notes = getAllSchoolNotes();
  return normalizeSchoolNoteEntry(notes[name]);
}

function getSchoolWorkspace(name) {
  const fallbackNote = getSchoolNoteData(name).text;
  const defaultWorkspace = {
    notes: fallbackNote,
    supplements: "",
    essayDraft: "",
    tasks: ""
  };

  const raw = localStorage.getItem(SCHOOL_WORKSPACE_STORAGE_KEY);
  if (!raw) return defaultWorkspace;

  try {
    const workspaceMap = JSON.parse(raw);
    if (!workspaceMap || typeof workspaceMap !== "object") return defaultWorkspace;
    const existing = workspaceMap[name];
    if (!existing || typeof existing !== "object") return defaultWorkspace;
    return {
      notes: existing.notes || fallbackNote || "",
      supplements: existing.supplements || "",
      essayDraft: existing.essayDraft || "",
      tasks: existing.tasks || ""
    };
  } catch (error) {
    return defaultWorkspace;
  }
}

function updateSchoolWorkspace(sectionKey, value) {
  if (!currentSchoolName) return;

  let workspaceMap = {};
  const raw = localStorage.getItem(SCHOOL_WORKSPACE_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        workspaceMap = parsed;
      }
    } catch (error) {
      workspaceMap = {};
    }
  }

  const existing = workspaceMap[currentSchoolName] && typeof workspaceMap[currentSchoolName] === "object"
    ? workspaceMap[currentSchoolName]
    : { notes: "", supplements: "", essayDraft: "", tasks: "" };

  workspaceMap[currentSchoolName] = {
    ...existing,
    [sectionKey]: value
  };

  localStorage.setItem(SCHOOL_WORKSPACE_STORAGE_KEY, JSON.stringify(workspaceMap));

  if (sectionKey === "notes") {
    const noteData = getSchoolNoteData(currentSchoolName);
    noteData.text = value;
    saveSchoolNoteData(currentSchoolName, noteData);
  }
}

function formatFileSize(size) {
  if (!size || typeof size !== "number") return "";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function addFileToCurrentSchool(file) {
  if (!currentSchoolName || !file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert("File size exceeded. Max 5MB per file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function(event) {
    const noteData = getSchoolNoteData(currentSchoolName);
    noteData.files.push({
      name: file.name,
      data: event.target.result,
      type: file.type,
      size: file.size
    });
    saveSchoolNoteData(currentSchoolName, noteData);
    const school = getSchoolFromCatalog(currentSchoolName);
    if (school) {
      renderPage("notes", school);
    }
  };
  reader.readAsDataURL(file);
}

function removeFileFromCurrentSchool(fileIndex) {
  if (!currentSchoolName) return;
  const noteData = getSchoolNoteData(currentSchoolName);
  noteData.files.splice(fileIndex, 1);
  saveSchoolNoteData(currentSchoolName, noteData);
  const school = getSchoolFromCatalog(currentSchoolName);
  if (school) {
    renderPage("notes", school);
  }
}

function getSchoolPageLinks(name) {
  const query = `?name=${encodeURIComponent(name)}`;
  return {
    overview: `school-detail.html${query}`,
    admissions: `school-admissions.html${query}`,
    programs: `school-programs.html${query}`,
    studentLife: `school-student-life.html${query}`,
    prompts: `school-prompts.html${query}`,
    notes: `school-notes.html${query}`
  };
}

function renderMissing() {
  document.getElementById("content").innerHTML = `
    <h1>School Not Found</h1>
    <div class="empty">
      I could not find this school in local app data yet.
      Open <strong>MatchU</strong> first to refresh local dataset.
    </div>
  `;
  document.getElementById("sectionNav").innerHTML = "";
}

function renderSectionNav(college, activeView) {
  const links = getSchoolPageLinks(college.name);
  const active = activeView || "overview";
  const linkClass = (viewName) => viewName === active ? "chip active" : "chip";
  document.getElementById("sectionNav").innerHTML = `
    <a class="${linkClass("overview")}" href="${links.overview}">Overview</a>
    <a class="${linkClass("admissions")}" href="${links.admissions}">Admissions</a>
    <a class="${linkClass("programs")}" href="${links.programs}">Programs</a>
    <a class="${linkClass("student-life")}" href="${links.studentLife}">Student Life</a>
    <a class="${linkClass("prompts")}" href="${links.prompts}">Prompts</a>
    <a class="${linkClass("notes")}" href="${links.notes}">My Notes</a>
  `;
}

function renderOverview(college) {
  const links = getSchoolPageLinks(college.name);
  return `
    <h1>${college.name}</h1>
    <p class="meta">${college.region}, ${college.state} · ${college.isPrivate ? "Private" : "Public"} · Deadline ${college.deadline || "N/A"}</p>
    <div class="card">
      <h2>Explore This School</h2>
      <div class="section-grid">
        <a class="section-link" href="${links.admissions}">
          <h3>Admissions</h3>
          <p class="meta">Acceptance rate, test policy, ranges, deadlines, and admissions stats.</p>
        </a>
        <a class="section-link" href="${links.programs}">
          <h3>Programs</h3>
          <p class="meta">Academic strengths, majors, and program-oriented cost context.</p>
        </a>
        <a class="section-link" href="${links.studentLife}">
          <h3>Student Life</h3>
          <p class="meta">Extracurriculars, campus-life details, and day-in-my-life snapshots stored in your dataset.</p>
        </a>
        <a class="section-link" href="${links.prompts}">
          <h3>Prompts</h3>
          <p class="meta">Previous application prompts and essay references for this school.</p>
        </a>
        <a class="section-link" href="${links.notes}">
          <h3>My Notes</h3>
          <p class="meta">Your notes, drafts, supplements, and to-do items.</p>
        </a>
      </div>
    </div>
    <div class="card">
      <h2>Quick Facts</h2>
      <div class="grid">
        <div class="stat"><div class="label">Acceptance Rate</div><div class="value">${acceptanceRate(college)}</div></div>
        <div class="stat"><div class="label">Application Deadline</div><div class="value">${college.deadline || "N/A"}</div></div>
        <div class="stat"><div class="label">Test Policy</div><div class="value">${college.testOptional ? "Test Optional" : "Test Required"}</div></div>
        <div class="stat"><div class="label">Undergraduate Size</div><div class="value">${college.fullUndergrad ? college.fullUndergrad.toLocaleString() : "N/A"}</div></div>
      </div>
      <div class="chip-row" style="margin-top:12px;">
        ${college.website ? `<a class="chip" href="${college.website}" target="_blank" rel="noopener noreferrer">Official Website</a>` : ""}
        ${college.admissionsUrl ? `<a class="chip" href="${college.admissionsUrl}" target="_blank" rel="noopener noreferrer">Admissions Site</a>` : ""}
      </div>
    </div>
  `;
}

function renderAdmissions(college) {
  return `
    <h1>${college.name}</h1>
    <p class="meta">${college.region}, ${college.state} · ${college.isPrivate ? "Private" : "Public"} · Admissions snapshot</p>
    <div class="card">
      <h2>Admissions</h2>
      <div class="grid">
        <div class="stat"><div class="label">Acceptance Rate</div><div class="value">${acceptanceRate(college)}</div></div>
        <div class="stat"><div class="label">SAT Range</div><div class="value">${college.satRange ? college.satRange.join(" - ") : "N/A"}</div></div>
        <div class="stat"><div class="label">ACT Range</div><div class="value">${college.actRange ? college.actRange.join(" - ") : "N/A"}</div></div>
        <div class="stat"><div class="label">Test Policy</div><div class="value">${college.testOptional ? "Test Optional" : "Test Required"}</div></div>
        <div class="stat"><div class="label">Application Deadline</div><div class="value">${college.deadline || "N/A"}</div></div>
        <div class="stat"><div class="label">Graduation Rate</div><div class="value">${college.gradRate ?? "N/A"}%</div></div>
        <div class="stat"><div class="label">Applications</div><div class="value">${college.applications ? college.applications.toLocaleString() : "N/A"}</div></div>
        <div class="stat"><div class="label">Accepted</div><div class="value">${college.accepted ? college.accepted.toLocaleString() : "N/A"}</div></div>
      </div>
    </div>
  `;
}

function renderPrograms(college) {
  const totalCost = (college.outstate || 0) + (college.roomBoard || 0) + (college.books || 0) + (college.personal || 0);
  const programs = Array.isArray(college.majorStrengths) ? college.majorStrengths : [];
  return `
    <h1>${college.name}</h1>
    <p class="meta">${college.region}, ${college.state} · Highlighted academic strengths from your local dataset</p>
    <div class="card">
      <h2>Programs</h2>
      <p class="meta" style="margin-bottom:12px;">This section shows highlighted strengths, not a complete list of every major offered by the school.</p>
      ${programs.length ? `<div class="chip-row">${programs.map((p) => `<span class="chip">${p}</span>`).join("")}</div>` : '<div class="empty">No highlighted program data in local dataset.</div>'}
      <div class="grid" style="margin-top:12px;">
        <div class="stat"><div class="label">Estimated Annual Cost</div><div class="value">${money(totalCost)}</div></div>
        <div class="stat"><div class="label">Undergraduate Size</div><div class="value">${college.fullUndergrad ? college.fullUndergrad.toLocaleString() : "N/A"}</div></div>
      </div>
    </div>
  `;
}

function renderStudentLife(college) {
  const extracurriculars = Array.isArray(college.extracurricularHighlights) ? college.extracurricularHighlights : [];
  const dayInMyLife = Array.isArray(college.dayInMyLife) ? college.dayInMyLife : [];
  return `
    <h1>${college.name}</h1>
    <p class="meta">${college.region}, ${college.state} · Student life and extracurriculars</p>
    <div class="card">
      <h2>Student Life</h2>
      ${extracurriculars.length
        ? `<ul class="list">${extracurriculars.map((e) => `<li>${e}</li>`).join("")}</ul>`
        : '<div class="empty">No extracurricular data saved in local dataset for this school yet.</div>'
      }
    </div>
    <div class="card">
      <h2>Day In My Life</h2>
      ${dayInMyLife.length
        ? `
        <div class="day-grid">
          ${dayInMyLife.map((item, index) => `
            <div class="day-card">
              <div class="day-step">Moment ${index + 1}</div>
              <div class="day-text">${escapeHtml(item)}</div>
            </div>
          `).join("")}
        </div>
        `
        : '<div class="empty">No day-in-my-life details are saved in the local dataset for this school yet.</div>'
      }
    </div>
  `;
}

function parsePromptEntry(prompt) {
  const raw = String(prompt || "").trim();
  const match = raw.match(/^(\d{4})\s*:\s*(.+)$/);
  if (match) {
    return {
      year: match[1],
      text: match[2]
    };
  }
  return {
    year: "Prompt",
    text: raw
  };
}

function renderPrompts(college) {
  const prompts = Array.isArray(college.promptHistory) ? college.promptHistory : [];
  const parsedPrompts = prompts.map(parsePromptEntry);
  const promptYears = parsedPrompts
    .map((prompt) => prompt.year)
    .filter((year) => /^\d{4}$/.test(year));
  const mostRecentYear = promptYears.length ? Math.max(...promptYears.map(Number)) : null;
  const workspace = getSchoolWorkspace(college.name);
  return `
    <h1>${college.name}</h1>
    <p class="meta">${college.region}, ${college.state} · Previous application prompts</p>
    <div class="card">
      <h2>Prompts</h2>
      ${parsedPrompts.length
        ? `
        <div class="prompt-summary">
          <div class="stat">
            <div class="label">Prompts Stored</div>
            <div class="value">${parsedPrompts.length}</div>
          </div>
          <div class="stat">
            <div class="label">Most Recent Year</div>
            <div class="value">${mostRecentYear || "N/A"}</div>
          </div>
          <div class="stat">
            <div class="label">Prompt Type</div>
            <div class="value">Supplements</div>
          </div>
        </div>
        <div class="prompt-grid">
          ${parsedPrompts.map((prompt) => `
            <div class="prompt-card">
              <div class="prompt-year">${escapeHtml(prompt.year)}</div>
              <div class="prompt-text">${escapeHtml(prompt.text)}</div>
            </div>
          `).join("")}
        </div>
        `
        : '<div class="empty">No prompt history is stored in local dataset for this school yet.</div>'
      }
    </div>
    <div class="card">
      <h2>Prompt Brainstorm</h2>
      <p class="meta" style="margin-bottom:12px;">Use this space for quick ideas, themes, and response fragments tied to this school’s supplements.</p>
      <textarea class="workspace-input" placeholder="Brainstorm angles, stories, and draft lines for this school's prompts..." oninput="updateSchoolWorkspace('supplements', this.value)">${escapeHtml(workspace.supplements)}</textarea>
      <div class="chip-row" style="margin-top:12px;">
        <a class="chip" href="${getSchoolPageLinks(college.name).notes}">Open Notes / Drafts</a>
      </div>
    </div>
  `;
}

function renderNotes(college) {
  const workspace = getSchoolWorkspace(college.name);
  const noteData = getSchoolNoteData(college.name);
  return `
    <h1>${college.name}</h1>
    <p class="meta">${college.region}, ${college.state} · Personal notes and drafts</p>
    <div class="card">
      <h2>Notes / Files</h2>
      <p class="meta" style="margin-bottom:12px;">Everything here autosaves for this school while you type.</p>
      <div class="chip-row" style="margin-bottom:12px;">
        <a class="chip" href="${getSchoolPageLinks(college.name).prompts}">View Past Prompts</a>
      </div>
      <div class="workspace-block" style="margin-bottom:12px;">
        <div class="workspace-title">Notes</div>
        <textarea class="workspace-input" placeholder="Add general notes, impressions, stats to remember..." oninput="updateSchoolWorkspace('notes', this.value)">${escapeHtml(workspace.notes)}</textarea>
        <input class="file-upload" type="file" accept="image/*,.pdf,.doc,.docx,.txt" onchange="addFileToCurrentSchool(this.files[0]); this.value='';" />
        <div class="helper-text">Upload images, PDFs, Word docs, or text files up to 5 MB each.</div>
        ${noteData.files.length
          ? `
          <div class="file-list">
            <div class="file-list-header">Attached Files (${noteData.files.length})</div>
            ${noteData.files.map((file, index) => `
              <div class="file-item">
                <div style="flex:1; min-width:0;">
                  <a class="file-link" href="${file.data}" download="${escapeHtml(file.name)}">${escapeHtml(file.name)}</a>
                  <span class="file-meta">${escapeHtml(file.type || "File")} · ${formatFileSize(file.size)}</span>
                </div>
                <button class="btn" type="button" onclick="removeFileFromCurrentSchool(${index})">Delete</button>
              </div>
            `).join("")}
          </div>
          `
          : '<div class="empty" style="margin-top:12px;">No files attached yet.</div>'
        }
      </div>
      <div class="workspace-grid">
        <div class="workspace-block">
          <div class="workspace-title">Supplement Drafts</div>
          <textarea class="workspace-input" placeholder="Draft school-specific short responses here..." oninput="updateSchoolWorkspace('supplements', this.value)">${escapeHtml(workspace.supplements)}</textarea>
        </div>
        <div class="workspace-block">
          <div class="workspace-title">Essay Draft</div>
          <textarea class="workspace-input" placeholder="Write longer essay ideas or draft paragraphs here..." oninput="updateSchoolWorkspace('essayDraft', this.value)">${escapeHtml(workspace.essayDraft)}</textarea>
        </div>
        <div class="workspace-block">
          <div class="workspace-title">To-Do / Questions</div>
          <textarea class="workspace-input" placeholder="Track deadlines, questions, and next steps..." oninput="updateSchoolWorkspace('tasks', this.value)">${escapeHtml(workspace.tasks)}</textarea>
        </div>
      </div>
    </div>
  `;
}

function renderPage(view, college) {
  currentSchoolName = college.name;
  renderSectionNav(college, view);

  let html = "";
  if (view === "admissions") html = renderAdmissions(college);
  else if (view === "programs") html = renderPrograms(college);
  else if (view === "student-life") html = renderStudentLife(college);
  else if (view === "prompts") html = renderPrompts(college);
  else if (view === "notes") html = renderNotes(college);
  else html = renderOverview(college);

  document.getElementById("content").innerHTML = html;
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const schoolName = params.get("name");
  const view = document.body.dataset.view || "overview";

  if (!schoolName) {
    renderMissing();
    return;
  }

  const school = getSchoolFromCatalog(schoolName);
  if (!school) {
    renderMissing();
    return;
  }

  renderPage(view, school);
});
