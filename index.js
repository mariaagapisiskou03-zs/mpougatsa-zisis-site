    function updateScrollOffset() {
      var header = document.querySelector('.site-header');
      if (header) {
        document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
      }
    }
    window.addEventListener('load', updateScrollOffset);
    window.addEventListener('resize', updateScrollOffset);

    document.querySelectorAll('.logo-link').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    (function revealAboutText() {
      var panel = document.querySelector('.about-text-panel');
      if (!panel) return;
      if (!('IntersectionObserver' in window)) { panel.classList.add('in-view'); return; }
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.25 });
      obs.observe(panel);
    })();

    (function highlightActiveNav() {
      var navLinks = Array.prototype.slice.call(document.querySelectorAll('.site-nav a[href^="#"]'));
      if (!navLinks.length) return;
      var sections = navLinks.map(function (link) {
        return document.querySelector(link.getAttribute('href'));
      }).filter(Boolean);
      if (!sections.length) return;

      function setActive(id) {
        navLinks.forEach(function (link) {
          link.classList.toggle('active', link.getAttribute('href') === '#' + id);
        });
      }

      if (!('IntersectionObserver' in window)) return;

      var current = null;
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            current = entry.target.id;
          }
        });
        if (current) setActive(current);
      }, {
        root: null,
        rootMargin: '-' + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 84) + 'px 0px -60% 0px',
        threshold: 0
      });
      sections.forEach(function (sec) { obs.observe(sec); });

      navLinks.forEach(function (link) {
        link.addEventListener('click', function () {
          setActive(link.getAttribute('href').slice(1));
        });
      });
    })();

    (function heroParallax() {
      var img = document.querySelector('.hero-img');
      var hero = document.querySelector('.hero');
      if (!img || !hero) return;
      var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) return;

      var ticking = false;
      var heroVisible = true;

      function update() {
        ticking = false;
        if (!heroVisible) return;
        var rect = hero.getBoundingClientRect();
        var offset = rect.top * -0.32;
        img.style.transform = 'translateY(' + offset + 'px)';
      }

      window.addEventListener('scroll', function () {
        if (!ticking) {
          window.requestAnimationFrame(update);
          ticking = true;
        }
      }, { passive: true });

      if ('IntersectionObserver' in window) {
        var obs = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) { heroVisible = entry.isIntersecting; });
        }, { threshold: 0 });
        obs.observe(hero);
      }

      update();
    })();

    (function stickyOrderButton() {
      var btn = document.getElementById('stickyOrderBtn');
      var hero = document.querySelector('.hero');
      var orderSection = document.getElementById('order');
      if (!btn || !hero) return;

      var pastHero = false;
      var inOrder = false;

      function refresh() {
        btn.classList.toggle('visible', pastHero && !inOrder);
      }

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) { pastHero = !entry.isIntersecting; });
          refresh();
        }, { threshold: 0 }).observe(hero);

        if (orderSection) {
          new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) { inOrder = entry.isIntersecting; });
            refresh();
          }, { threshold: 0.15 }).observe(orderSection);
        }
      } else {
        window.addEventListener('scroll', function () {
          pastHero = window.scrollY > hero.offsetHeight * 0.8;
          refresh();
        }, { passive: true });
      }
    })();
  

    (function orderSystem() {
      // Live menu + orders come from Supabase (real Postgres database).
      var SUPABASE_URL = 'https://jjhdredjsajovwmpdtnk.supabase.co';
      var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqaGRyZWRqc2Fqb3Z3bXBkdG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMzk2NjAsImV4cCI6MjEwMzcxNTY2MH0.OdcIK2Ek8Sn-bAfOMoq2owu8-GV93bhPUDdExq-Pu5g';

      function supabaseRpc(fnName, args) {
        return fetch(SUPABASE_URL + '/rest/v1/rpc/' + fnName, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
          },
          body: JSON.stringify(args || {})
        }).then(function (res) { return res.json(); });
      }

      // Fallback menu, used only if the live database can't be reached.
      var FALLBACK_PRODUCTS = {
        bougatsa: [
          { id: 'bg-krema', name: 'Μπουγάτσα Κρέμα', price: 2.00 },
          { id: 'bg-tyri', name: 'Μπουγάτσα Τυρί', price: 2.00 },
          { id: 'bg-kima', name: 'Μπουγάτσα Κιμά', price: 2.00 },
          { id: 'bg-spanaki', name: 'Μπουγάτσα Σπανάκι', price: 2.00 }
        ],
        kourou: [
          { id: 'kr-tyri', name: 'Κουρού Τυρί', price: 0.40 },
          { id: 'kr-spanaki', name: 'Κουρού Σπανάκι', price: 0.40 },
          { id: 'kr-elia', name: 'Κουρού Ελιά', price: 0.40 },
          { id: 'kr-olikis', name: 'Κουρού Ολικής', price: 0.40 }
        ],
        'allantika-mini': [
          { id: 'am-zabontyri', name: 'Ζαμπόν Τυρί', price: 0.50 },
          { id: 'am-loukaniko', name: 'Λουκανικοπιτάκια', price: 0.50 },
          { id: 'am-philtyri', name: 'Φιλαδέλφεια Τυριά', price: 0.50 },
          { id: 'am-philgalo', name: 'Φιλαδέλφεια Γαλοπούλα', price: 0.50 },
          { id: 'am-koto', name: 'Κοτοπιτάκια', price: 0.50 },
          { id: 'am-xoriatikitiyri', name: 'Πίτα Χωριάτικη Τυρί', price: 0.50 },
          { id: 'am-xoriatikispanakotyri', name: 'Πίτα Χωριάτικη Σπανακοτύρι', price: 0.50 }
        ],
        'allantika-large': [
          { id: 'al-diplolouk', name: 'Διπλό Λουκάνικο', price: 2.00 },
          { id: 'al-peinirli', name: 'Πεϊνιρλί', price: 2.00 },
          { id: 'al-kotopoulo', name: 'Κοτόπουλο', price: 2.00 },
          { id: 'al-bacontyri', name: 'Μπέικον Τυρί', price: 2.00 },
          { id: 'al-kaltsone', name: 'Καλτσόνε', price: 2.00 },
          { id: 'al-boureki', name: 'Μπουρέκι', price: 1.30 },
          { id: 'al-zabonkaseri', name: 'Ζαμπόν-Κασέρι', price: 2.00 }
        ]
      };
      var PRODUCTS = FALLBACK_PRODUCTS;
      var CATEGORY_LABELS = {
        bougatsa: 'Μπουγάτσα',
        kourou: 'Κουρού',
        'allantika-mini': 'Αλλαντικά Mini',
        'allantika-large': 'Αλλαντικά Μεγάλα'
      };
      var cart = {};
      var selectedPayment = 'cash';
      var PAYMENT_LABELS = { cash: 'Μετρητά', card: 'Κάρτα (κατά την παράδοση)' };

      function fmt(n) { return n.toFixed(2).replace('.', ',') + '€'; }
      function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

      function renderPanel(cat) {
        var panel = document.getElementById('orderPanel');
        if (!panel) return;
        var items = (PRODUCTS[cat] || []).filter(function (p) { return p.available !== false; });
        var rows = items.map(function (p) {
          return '' +
            '<div class="order-row" data-id="' + p.id + '" data-name="' + esc(p.name) + '" data-price="' + p.price + '">' +
              '<span class="order-row__name">' + esc(p.name) + '</span>' +
              '<span class="order-row__price">' + fmt(p.price) + '</span>' +
              '<span class="order-row__qty">' +
                '<button type="button" class="qty-btn" data-action="dec" aria-label="Μείωση ποσότητας">&minus;</button>' +
                '<span class="qty-value">0</span>' +
                '<button type="button" class="qty-btn" data-action="inc" aria-label="Αύξηση ποσότητας">+</button>' +
              '</span>' +
              '<button type="button" class="order-add-btn" data-action="add">ΠΡΟΣΘΗΚΗ</button>' +
            '</div>';
        }).join('');
        panel.innerHTML =
          '<h3 class="order-panel__title">' + esc(CATEGORY_LABELS[cat] || '') + '</h3>' +
          '<div class="order-table">' +
            '<div class="order-table__head"><span>Προϊόν</span><span>Τιμή</span><span>Ποσότητα</span><span></span></div>' +

            rows +
          '</div>';
      }

      var MIN_ORDER = 10.00;

      function renderCart() {
        var itemsEl = document.getElementById('cartItems');
        var ids = Object.keys(cart);
        if (!itemsEl) return;
        if (ids.length === 0) {
          itemsEl.innerHTML = '<p class="order-cart__empty">Το καλάθι σας είναι άδειο</p>';
        } else {
          itemsEl.innerHTML = ids.map(function (id) {
            var it = cart[id];
            return '' +
              '<div class="cart-item" data-id="' + id + '">' +
                '<div class="cart-item__info">' +
                  '<span class="cart-item__name">' + esc(it.name) + '</span>' +
                  '<span class="cart-item__price">' + fmt(it.price) + '</span>' +
                '</div>' +
                '<span class="cart-item__qty">' +
                  '<button type="button" class="qty-btn qty-btn--sm" data-cart-action="dec" aria-label="Μείωση">&minus;</button>' +
                  '<span class="qty-value">' + it.qty + '</span>' +
                  '<button type="button" class="qty-btn qty-btn--sm" data-cart-action="inc" aria-label="Αύξηση">+</button>' +
                '</span>' +
                '<button type="button" class="cart-item__remove" data-cart-action="remove" aria-label="Αφαίρεση">&times;</button>' +
              '</div>';
          }).join('');
        }
        var total = ids.reduce(function (sum, id) { return sum + cart[id].price * cart[id].qty; }, 0);
        var totalEl = document.getElementById('cartTotal');
        if (totalEl) totalEl.textContent = fmt(total);
        var checkoutBtn = document.getElementById('checkoutBtn');
        var belowMin = ids.length > 0 && total < MIN_ORDER;
        if (checkoutBtn) checkoutBtn.classList.toggle('is-disabled', ids.length === 0 || belowMin);
        var minHintEl = document.getElementById('cartMinHint');
        if (minHintEl) {
          if (belowMin) {
            minHintEl.textContent = 'Ελάχιστη παραγγελία ' + fmt(MIN_ORDER) + ' — προσθέστε ακόμη ' + fmt(MIN_ORDER - total) + '.';
            minHintEl.hidden = false;
          } else {
            minHintEl.hidden = true;
          }
        }
      }

      function addToCart(id, name, price, qty) {
        if (qty <= 0) return;
        if (cart[id]) { cart[id].qty += qty; }
        else { cart[id] = { name: name, price: price, qty: qty }; }
        renderCart();
      }

      document.addEventListener('click', function (e) {
        var tab = e.target.closest('.order-tab');
        if (tab) {
          document.querySelectorAll('.order-tab').forEach(function (t) { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
          tab.classList.add('is-active');
          tab.setAttribute('aria-selected', 'true');
          renderPanel(tab.getAttribute('data-category'));
          return;
        }

        var qtyBtn = e.target.closest('.order-row .qty-btn');
        if (qtyBtn) {
          var row = qtyBtn.closest('.order-row');
          var valEl = row.querySelector('.qty-value');
          var val = parseInt(valEl.textContent, 10) || 0;
          val = qtyBtn.dataset.action === 'inc' ? val + 1 : Math.max(0, val - 1);
          valEl.textContent = val;
          return;
        }

        var addBtn = e.target.closest('.order-add-btn');
        if (addBtn) {
          var row2 = addBtn.closest('.order-row');
          var valEl2 = row2.querySelector('.qty-value');
          var qty = parseInt(valEl2.textContent, 10) || 0;
          if (qty > 0) {
            addToCart(row2.dataset.id, row2.dataset.name, parseFloat(row2.dataset.price), qty);
            valEl2.textContent = '0';
          }
          return;
        }

        var cartQtyBtn = e.target.closest('.cart-item .qty-btn');
        if (cartQtyBtn) {
          var item = cartQtyBtn.closest('.cart-item');
          var id2 = item.dataset.id;
          if (cartQtyBtn.dataset.cartAction === 'inc') cart[id2].qty += 1;
          else cart[id2].qty = Math.max(0, cart[id2].qty - 1);
          if (cart[id2].qty === 0) delete cart[id2];
          renderCart();
          return;
        }

        var removeBtn = e.target.closest('.cart-item__remove');
        if (removeBtn) {
          var item2 = removeBtn.closest('.cart-item');
          delete cart[item2.dataset.id];
          renderCart();
          return;
        }

        var continueBtn = e.target.closest('#continueBtn');
        if (continueBtn) {
          var orderSection = document.getElementById('order');
          if (orderSection) orderSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }

        var paymentBtn = e.target.closest('.order-payment-option');
        if (paymentBtn) {
          document.querySelectorAll('.order-payment-option').forEach(function (b) {
            b.classList.remove('is-active');
            b.setAttribute('aria-checked', 'false');
          });
          paymentBtn.classList.add('is-active');
          paymentBtn.setAttribute('aria-checked', 'true');
          selectedPayment = paymentBtn.getAttribute('data-payment');
          return;
        }

        var checkoutBtn2 = e.target.closest('#checkoutBtn');
        if (checkoutBtn2) {
          var ids2 = Object.keys(cart);
          if (ids2.length === 0) return;
          var total2 = ids2.reduce(function (sum, id) { return sum + cart[id].price * cart[id].qty; }, 0);
          if (total2 < MIN_ORDER) return;
          document.getElementById('cartNormalView').hidden = true;
          document.getElementById('orderDeliveryForm').hidden = false;
          return;
        }

        var deliveryBackBtn = e.target.closest('#deliveryBackBtn');
        if (deliveryBackBtn) {
          document.getElementById('orderDeliveryForm').hidden = true;
          document.getElementById('cartNormalView').hidden = false;
          return;
        }

        var deliveryContinueBtn = e.target.closest('#deliveryContinueBtn');
        if (deliveryContinueBtn) {
          var nameEl = document.getElementById('custName');
          var phoneEl = document.getElementById('custPhone');
          var streetEl = document.getElementById('custStreet');
          var numberEl = document.getElementById('custNumber');
          var intercomEl = document.getElementById('custIntercom');
          var errorEl = document.getElementById('orderFormError');

          var name = nameEl.value.trim();
          var phone = phoneEl.value.trim();
          var street = streetEl.value.trim();
          var number = numberEl.value.trim();
          var intercom = intercomEl.value.trim();

          [nameEl, phoneEl, streetEl, numberEl].forEach(function (el) { el.classList.remove('has-error'); });

          var missing = [];
          if (!name) missing.push(nameEl);
          if (!phone) missing.push(phoneEl);
          if (!street) missing.push(streetEl);
          if (!number) missing.push(numberEl);

          if (missing.length) {
            missing.forEach(function (el) { el.classList.add('has-error'); });
            if (errorEl) errorEl.hidden = false;
            missing[0].focus();
            return;
          }
          if (errorEl) errorEl.hidden = true;

          if (selectedPayment === 'card') {
            document.getElementById('orderDeliveryForm').hidden = true;
            document.getElementById('orderCardNotice').hidden = false;
            return;
          }

          var address = street + ' ' + number;
          var ids3 = Object.keys(cart);
          var total = ids3.reduce(function (sum, id) { return sum + cart[id].price * cart[id].qty; }, 0);
          var itemsLine = ids3.map(function (id) { return cart[id].qty + '× ' + cart[id].name; }).join(', ');

          function estimatedDeliveryTime() {
            var t = new Date(Date.now() + 30 * 60000);
            var hh = String(t.getHours()).padStart(2, '0');
            var mm = String(t.getMinutes()).padStart(2, '0');
            return hh + ':' + mm;
          }

          function showConfirmScreen(orderIdLabel) {
            var listEl = document.getElementById('orderConfirmList');
            if (listEl) {
              var lines = [];
              if (orderIdLabel) lines.push(['Αρ. Παραγγελίας', orderIdLabel]);
              lines.push(['Εκτιμώμενη Ώρα Παράδοσης', '&asymp; 30 λεπτά (~' + estimatedDeliveryTime() + ')']);
              lines.push(['Είδη', itemsLine]);
              lines.push(['Σύνολο', fmt(total)]);
              lines.push(['Όνομα', esc(name)]);
              lines.push(['Τηλέφωνο', esc(phone)]);
              lines.push(['Διεύθυνση', esc(address)]);
              if (intercom) lines.push(['Θυροτηλέφωνο', esc(intercom)]);
              lines.push(['Πληρωμή', PAYMENT_LABELS[selectedPayment]]);
              listEl.innerHTML = lines.map(function (l) {
                return '<p><span class="order-confirm__label">' + l[0] + ':</span>' + l[1] + '</p>';
              }).join('');
            }
            document.getElementById('orderDeliveryForm').hidden = true;
            document.getElementById('cartConfirm').hidden = false;
          }

          var isNumericIds = ids3.every(function (id) { return /^\d+$/.test(id); });
          if (isNumericIds) {
            // Product ids came from the live database — submit a real order.
            deliveryContinueBtn.disabled = true;
            var items = ids3.map(function (id) { return { product_id: Number(id), quantity: cart[id].qty }; });
            supabaseRpc('public_create_order', {
              p_customer_name: name,
              p_customer_phone: phone,
              p_street: street,
              p_street_number: number,
              p_intercom: intercom || null,
              p_payment_method: 'cash',
              p_items: items
            }).then(function (result) {
              deliveryContinueBtn.disabled = false;
              if (result && result.order_id) {
                showConfirmScreen('#' + result.order_id);
              } else if (result && result.error === 'below_minimum') {
                if (errorEl) {
                  errorEl.textContent = 'Ελάχιστη παραγγελία ' + fmt(Number(result.minimum)) + '. Προσθέστε ακόμη προϊόντα στο καλάθι.';
                  errorEl.hidden = false;
                }
                document.getElementById('orderDeliveryForm').hidden = true;
                document.getElementById('cartNormalView').hidden = false;
              } else {
                showConfirmScreen(null);
              }
            }).catch(function () {
              deliveryContinueBtn.disabled = false;
              showConfirmScreen(null);
            });
          } else {
            // Fallback menu was in use (live database was unreachable) — no real order to submit.
            showConfirmScreen(null);
          }
          return;
        }

        var switchToCashBtn = e.target.closest('#switchToCashBtn');
        if (switchToCashBtn) {
          document.querySelectorAll('.order-payment-option').forEach(function (b) {
            var isCash = b.getAttribute('data-payment') === 'cash';
            b.classList.toggle('is-active', isCash);
            b.setAttribute('aria-checked', isCash ? 'true' : 'false');
          });
          selectedPayment = 'cash';
          document.getElementById('orderCardNotice').hidden = true;
          document.getElementById('orderDeliveryForm').hidden = false;
          return;
        }

        var cardNoticeBackBtn = e.target.closest('#cardNoticeBackBtn');
        if (cardNoticeBackBtn) {
          document.getElementById('orderCardNotice').hidden = true;
          document.getElementById('orderDeliveryForm').hidden = false;
          return;
        }

        var newOrderBtn = e.target.closest('#newOrderBtn');
        if (newOrderBtn) {
          cart = {};
          renderCart();
          ['custName', 'custPhone', 'custStreet', 'custNumber', 'custIntercom'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.value = '';
          });
          document.getElementById('cartConfirm').hidden = true;
          document.getElementById('cartNormalView').hidden = false;
          return;
        }
      });

      ['custName', 'custPhone', 'custStreet', 'custNumber'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', function () { el.classList.remove('has-error'); });
      });

      function loadLiveProducts() {
        supabaseRpc('public_get_products').then(function (rows) {
          if (!Array.isArray(rows) || rows.length === 0) return;
          var grouped = {};
          rows.forEach(function (r) {
            var slug = r.category_slug;
            if (!slug) return;
            if (!grouped[slug]) grouped[slug] = [];
            grouped[slug].push({ id: String(r.id), name: r.name, price: Number(r.price), available: r.available });
          });
          PRODUCTS = grouped;
          var activeTab = document.querySelector('.order-tab.is-active');
          renderPanel(activeTab ? activeTab.getAttribute('data-category') : 'bougatsa');
        }).catch(function () {
          // Live database unreachable — keep using the fallback menu already rendered.
        });
      }

      renderPanel('bougatsa');
      renderCart();
      loadLiveProducts();
    })();
  
