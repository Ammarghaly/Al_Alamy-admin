import { db, ref, onValue, push, set, update, remove, get, child } from "./firebase.js";

const IMGBB_API_KEY = "21bebe487670b128922c3f919c20b059";
const defaultCategories = ["كريبات", "برجر", "وجبات", "إضافات"];

// DOM Elements
const authOverlay = document.getElementById('authOverlay');
const adminDashboard = document.getElementById('adminDashboard');
const loginBtn = document.getElementById('loginBtn');
const adminPassInput = document.getElementById('adminPass');

// 1. Database-Protected Authentication
loginBtn.onclick = async () => {
  const enteredPass = adminPassInput.value.trim();
  if (enteredPass.length < 5) {
    return alert("كلمة المرور غير مكتملة!");
  }

  loginBtn.disabled = true;
  loginBtn.innerText = "⏳ جاري التحقق...";

  try {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, `Al_Alamy/admin_config/password`));
    
    if (snapshot.exists()) {
      const securePass = snapshot.val();
      if (enteredPass === String(securePass)) {
        authOverlay.style.display = 'none';
        adminDashboard.style.display = 'block';
        init();
      } else {
        alert("كلمة المرور غير صحيحة!");
      }
    } else {
      alert("خطأ: لم يتم ضبط كلمة المرور في قاعدة البيانات.");
    }
  } catch (error) {
    console.error("Auth Error:", error);
    alert("فشل الاتصال بقاعدة البيانات.");
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerText = "دخول";
  }
};

const productForm = document.getElementById('productForm');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const productsGrid = document.getElementById('adminProductsGrid');
const adminSearch = document.getElementById('adminSearch');

const pPrice = document.getElementById('pPrice');
const pCategorySelect = document.getElementById('pCategorySelect');
const openCatModal = document.getElementById('openCatModal');
const closeCatBtn = document.getElementById('closeCatBtn');
const saveCatBtn = document.getElementById('saveCatBtn');
const catModal = document.getElementById('catModal');
const newCatName = document.getElementById('newCatName');
const cImage = document.getElementById('cImage');
const cPreviewBox = document.getElementById('cPreviewBox');
const cImageUrlInput = document.getElementById('cImageUrl');
const productIdInput = document.getElementById('productId');

let isEditMode = false;
let currentProducts = [];
let addedCategories = []; // Categories added via popup but not yet in DB
let rawCategories = [];

// 2. Main Logic Initialization
function init() {
  const catRef = ref(db, "Al_Alamy/categories");
  
  onValue(catRef, (snapshot) => {
    rawCategories = snapshot.val() || [];
    // Convert to array if it is an object
    if (!Array.isArray(rawCategories)) {
      rawCategories = Object.keys(rawCategories).map(k => rawCategories[k]);
    }

    currentProducts = [];
    rawCategories.forEach((cat, cIdx) => {
      if (cat && cat.items) {
        const itemsArray = Array.isArray(cat.items) ? cat.items : Object.values(cat.items);
        itemsArray.forEach((item, iIdx) => {
          if (item) {
            currentProducts.push({
              id: `${cIdx}_${iIdx}`,
              cIdx,
              iIdx,
              categoryId: cat.id,
              category: cat.name,
              categoryImage: cat.image,
              ...item
            });
          }
        });
      }
    });
    updateCategorySelect();
    renderCategories();
    renderProducts();
  });
}

// 2.5 Dynamic Category List
function updateCategorySelect() {
  const currentVal = pCategorySelect.value;
  const categories = new Set([...defaultCategories, ...addedCategories]);
  
  currentProducts.forEach(p => {
    if (p.category) categories.add(p.category);
  });

  const sortedCategories = Array.from(categories).sort();
  
  pCategorySelect.innerHTML = '<option value="" disabled selected>اختر التصنيف...</option>';
  sortedCategories.forEach(cat => {
    pCategorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
  });
  
  if (currentVal && Array.from(pCategorySelect.options).some(o => o.value === currentVal)) {
    pCategorySelect.value = currentVal;
  }
}

// 3. Render Product List
function renderProducts() {
  const searchTerm = adminSearch ? adminSearch.value.toLowerCase() : '';
  productsGrid.innerHTML = '';
  
  const filteredProducts = currentProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm) || 
    p.category.toLowerCase().includes(searchTerm)
  );

  filteredProducts.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    // Display either array of prices or single price
    const displayPrice = p.prices ? `${p.prices.small || p.prices.regular || Object.values(p.prices)[0]} ج.م` : `${p.price} ج.م`;
    const imageToShow = p.image || p.categoryImage || "https://images.unsplash.com/photo-1544025162-d76694265947?w=200";

    card.innerHTML = `
      <div class="card-img-wrapper">
        <div class="price-tag">${displayPrice}</div>
        <img src="${imageToShow}" class="card-img" alt="${p.name}">
      </div>
      <div class="card-body">
        <div class="card-cat">${p.category}</div>
        <div class="card-title">${p.name}</div>
        <div class="action-btns">
          <button class="btn btn-edit" onclick="window.editProduct('${p.id}')">تعديل</button>
          <button class="btn btn-danger" onclick="window.deleteProduct('${p.id}')">حذف</button>
        </div>
      </div>
    `;
    productsGrid.appendChild(card);
  });
}

function renderCategories() {
  const grid = document.getElementById('adminCategoriesGrid');
  if(!grid) return;
  grid.innerHTML = '';
  rawCategories.forEach((cat, cIdx) => {
    if(!cat) return;
    const card = document.createElement('div');
    card.className = 'product-card';
    card.style.height = '100%';
    const img = cat.image || "https://images.unsplash.com/photo-1544025162-d76694265947?w=200";
    card.innerHTML = `
      <div class="card-img-wrapper" style="height: 100px;">
        <img src="${img}" class="card-img" alt="${cat.name}">
      </div>
      <div class="card-body" style="padding: 10px;">
        <div class="card-title" style="font-size: 14px; text-align: center;">${cat.name}</div>
        <div class="action-btns" style="margin-top: 10px; flex-direction: column; gap: 5px;">
          <button class="btn btn-edit" style="width:100%; padding: 5px; font-size: 12px; margin: 0;" onclick="window.editCategory(${cIdx})">تعديل</button>
          <button class="btn btn-danger" style="width:100%; padding: 5px; font-size: 12px; margin: 0;" onclick="window.deleteCategory(${cIdx})">حذف</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// 4. Search & Category Implementation
if (adminSearch) {
  adminSearch.oninput = renderProducts;
}

const openCatModals = [document.getElementById('openCatModal'), document.getElementById('openCatModalTop')];
openCatModals.forEach(btn => {
  if (btn) btn.onclick = () => {
    document.getElementById('editCatId').value = '';
    document.getElementById('catModalTitle').innerText = 'إضافة تصنيف جديد';
    newCatName.value = '';
    cImageUrlInput.value = '';
    cPreviewBox.innerHTML = '<span style="color: var(--text-muted);">المعاينة تظهر هنا</span>';
    catModal.classList.add('active');
    newCatName.focus();
  };
});

if (closeCatBtn) {
  closeCatBtn.onclick = () => {
    catModal.classList.remove('active');
    newCatName.value = '';
  };
}

if (saveCatBtn) {
  saveCatBtn.onclick = async () => {
    const name = newCatName.value.trim();
    if (!name) return alert("يرجى كتابة اسم التصنيف!");
    
    const imageUrl = cImageUrlInput.value || "https://images.unsplash.com/photo-1544025162-d76694265947?w=200";
    const editIdStr = document.getElementById('editCatId').value;

    saveCatBtn.disabled = true;
    saveCatBtn.innerText = "⏳ جاري الحفظ...";

    try {
      if (editIdStr !== "") {
          const cIdx = parseInt(editIdStr);
          rawCategories[cIdx].name = name;
          rawCategories[cIdx].image = imageUrl;
      } else {
          rawCategories.push({
              id: `cat-${Date.now()}`,
              name: name,
              image: imageUrl,
              items: []
          });
      }
      
      await set(ref(db, "Al_Alamy/categories"), rawCategories);
      
      catModal.classList.remove('active');
      
      alert(editIdStr !== "" ? "تم تعديل التصنيف بنجاح!" : "تمت إضافة التصنيف بنجاح!");
    } catch(err) {
       alert("خطأ في حفظ التصنيف");
    } finally {
       saveCatBtn.disabled = false;
       saveCatBtn.innerText = "حفظ";
    }
  };
}

// 5. Image Handling for Categories (Compression + ImgBB)
if (cImage) {
  cImage.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    saveCatBtn.disabled = true;
    saveCatBtn.innerText = "⏳ جاري رفع الصورة...";

    try {
      const compressedBase64 = await compressImage(file);
      const uploadedUrl = await uploadToImgBB(compressedBase64);
      
      cImageUrlInput.value = uploadedUrl;
      cPreviewBox.innerHTML = `<img src="${uploadedUrl}" style="max-width: 100%; border-radius: 8px;" />`;
      saveCatBtn.disabled = false;
      saveCatBtn.innerText = "حفظ";
    } catch (err) {
      alert("فشل رفع الصورة. حاول مرة أخرى.");
      console.error(err);
      saveCatBtn.disabled = false;
      saveCatBtn.innerText = "حفظ";
    }
  };
}

function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadToImgBB(base64) {
  const body = new FormData();
  body.append('image', base64);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: body
  });
  const data = await res.json();
  if (data.success) return data.data.url;
  throw new Error("ImgBB Upload Failed");
}

// 6. Form Submission (Add/Edit)
productForm.onsubmit = async (e) => {
  e.preventDefault();
  const selectedCategory = pCategorySelect.value;
  if (!selectedCategory) return alert("يرجى تحديد التصنيف");
  
  const data = {
    name: pName.value.trim(),
    price: parseFloat(pPrice.value)
  };

  submitBtn.disabled = true;
  submitBtn.innerText = "⏳ جاري الحفظ...";

  try {
    let targetCatIdx = rawCategories.findIndex(c => c && c.name === selectedCategory);
    
    if (targetCatIdx === -1) {
        return alert("حدث خطأ: التصنيف المحدد غير موجود. قم بإضافته أولاً عبر زر الزائد.");
    }

    if (isEditMode) {
      const parts = productIdInput.value.split('_');
      const oldCIdx = parseInt(parts[0]);
      const oldIIdx = parseInt(parts[1]);
      
      const oldItem = rawCategories[oldCIdx].items[oldIIdx];
      
      if (oldCIdx === targetCatIdx) {
          rawCategories[oldCIdx].items[oldIIdx] = { ...oldItem, ...data };
      } else {
          // move to new category
          rawCategories[oldCIdx].items.splice(oldIIdx, 1);
          if (!rawCategories[targetCatIdx].items) rawCategories[targetCatIdx].items = [];
          rawCategories[targetCatIdx].items.push({ ...oldItem, ...data });
      }
    } else {
      if (!rawCategories[targetCatIdx].items) rawCategories[targetCatIdx].items = [];
      rawCategories[targetCatIdx].items.push(data);
    }
    
    // Save full categories array back to Firebase guaranteeing consistency
    await set(ref(db, "Al_Alamy/categories"), rawCategories);
    
    resetForm();
    alert("تم نجاح العملية!");
  } catch (err) {
    console.error("Realtime DB Error:", err);
    alert("حدث خطأ أثناء الحفظ.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "حفظ الطبق";
  }
};

// 7. Global Helper Functions
window.editProduct = (id) => {
  const p = currentProducts.find(x => x.id === id);
  if (!p) return;

  isEditMode = true;
  productIdInput.value = id;
  
  const pNameInput = document.getElementById('pName');
  if (pNameInput) pNameInput.value = p.name;
  
  if (p.prices) {
      pPrice.value = p.prices.small || p.prices.regular || Object.values(p.prices)[0] || 0;
  } else {
      pPrice.value = p.price || 0;
  }
  
  // Handle Category Select
  const options = Array.from(pCategorySelect.options).map(o => o.value);
  if (!options.includes(p.category)) {
    addedCategories.push(p.category);
    updateCategorySelect();
  }
  pCategorySelect.value = p.category;

  
  document.getElementById('formTitle').innerText = "تعديل: " + p.name;
  submitBtn.innerText = "تحديث الطبق";
  cancelBtn.style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteProduct = async (id) => {
  if (!confirm("هل أنت متأكد من حذف هذا الطبق؟")) return;
  const parts = id.split('_');
  const cIdx = parseInt(parts[0]);
  const iIdx = parseInt(parts[1]);
  
  rawCategories[cIdx].items.splice(iIdx, 1);
  
  try {
    await set(ref(db, "Al_Alamy/categories"), rawCategories);
  } catch (err) {
    alert("فشل الحذف.");
  }
};

window.editCategory = (cIdx) => {
  const cat = rawCategories[cIdx];
  if(!cat) return;
  document.getElementById('editCatId').value = cIdx;
  document.getElementById('catModalTitle').innerText = 'تعديل التصنيف: ' + cat.name;
  newCatName.value = cat.name;
  cImageUrlInput.value = cat.image || '';
  cPreviewBox.innerHTML = cat.image ? `<img src="${cat.image}" style="max-width: 100%; border-radius: 8px;" />` : '<span style="color: var(--text-muted);">المعاينة تظهر هنا</span>';
  catModal.classList.add('active');
};

window.deleteCategory = async (cIdx) => {
  const cat = rawCategories[cIdx];
  if(!cat) return;
  if (!confirm(`هل أنت متأكد من حذف قسم "${cat.name}" بالكامل مع جميع وجباته؟ هذا الإجراء لا يمكن التراجع عنه!`)) return;
  
  rawCategories.splice(cIdx, 1);
  try {
    await set(ref(db, "Al_Alamy/categories"), rawCategories);
    alert("تم حذف التصنيف بنجاح.");
  } catch (err) {
    alert("فشل الحذف.");
  }
};

cancelBtn.onclick = resetForm;

function resetForm() {
  productForm.reset();
  isEditMode = false;
  productIdInput.value = '';
  document.getElementById('formTitle').innerText = "إضافة طبق جديد";
  submitBtn.innerText = "حفظ الطبق";
  cancelBtn.style.display = 'none';
}

// ---------------- PWA INSTALL LOGIC ----------------
let deferredPrompt;
const installPopup = document.getElementById('installPopup');
const installBtn = document.getElementById('installBtn');
const closeInstall = document.getElementById('closeInstall');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installPopup) {
    installPopup.classList.remove('hidden');
  }
});

if (installBtn) {
  installBtn.onclick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Admin install prompt: ${outcome}`);
    deferredPrompt = null;
    installPopup.classList.add('hidden');
  };
}

if (closeInstall) {
  closeInstall.onclick = () => {
    installPopup.classList.add('hidden');
  };
}
