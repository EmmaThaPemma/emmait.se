const hueSlider = document.getElementById('hue-slider');

function updateHue(hue) {
            hueSlider.value = hue;
            document.documentElement.style.setProperty('--hue', hue);
            hue = Number(hue);
        }
hueSlider.addEventListener('input', function () {
            updateHue(hueSlider.value);
        });
