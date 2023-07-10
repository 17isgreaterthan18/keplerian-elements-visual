import * as THREE from 'three';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let display_true_anomaly = 0;
let display_periapsis_argument = 0;
let display_inclination = Math.PI / 4;
let display_longitude = 0;
let display_eccentricity = 0.5;
let display_semimajor = 10;
let display_res = 0.05;
let orbit_desc = [display_true_anomaly, display_eccentricity, display_semimajor, display_periapsis_argument, display_inclination, display_longitude, display_res]

let renderer = new SVGRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

init();

const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.up = new THREE.Vector3(0, 0, 1);
camera.position.set(20, 20, 10);
camera.lookAt(0, 0, 0)

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.minDistance = 6;
controls.maxDistance = 100;
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 4.0;

let scene = new THREE.Scene();
scene.background = new THREE.Color(0, 0, 0);

const earth_geo = new THREE.OctahedronGeometry(1.5, 5);
const earth_mat = new THREE.MeshBasicMaterial({color: 0x00dd00});
const earth = new THREE.Mesh(earth_geo, earth_mat);
scene.add(earth);

const refplane = new THREE.PolarGridHelper(10);
refplane.rotation.x = 0.5 * Math.PI;
scene.add(refplane);

let orbit_points = plot_orbit(display_eccentricity, display_semimajor, display_periapsis_argument, display_inclination, display_longitude, display_res);
orbit_points.push(orbit_points[0]);
const orbit_mat = new THREE.LineBasicMaterial({color: 0x0000ff, linewidth: 4});
let orbit_geo = new THREE.BufferGeometry().setFromPoints(orbit_points);
let orbit = new THREE.LineLoop(orbit_geo, orbit_mat);
scene.add(orbit);

const satellite_mat = new THREE.MeshBasicMaterial({color: 0xff0000});
const satellite_geo = new THREE.OctahedronGeometry(0.13, 5);
const satellite = new THREE.Mesh(satellite_geo, satellite_mat);
satellite.position.copy(plot_orbit_point());
scene.add(satellite);

let arrowVectors = getArrowVectors();
const arrow = new THREE.ArrowHelper(arrowVectors[0], arrowVectors[1], 3, 0xffff00)
scene.add(arrow);

const apsides_line_mat = new THREE.LineDashedMaterial({color: 0xaaaa00, linewidth: 1, gapsize: 4, dashsize: 5, scale: 1});
let apsides_line_points = [plot_orbit_point(0), plot_orbit_point(Math.PI)];
let apsides_line_geo = new THREE.BufferGeometry().setFromPoints(apsides_line_points);
const apsides_line = new THREE.Line(apsides_line_geo, apsides_line_mat);
scene.add(apsides_line);

// let velocity = orbit_point_velocity();


function animate() {
	
	controls.update();

	const new_orbit_desc = [display_true_anomaly, display_eccentricity, display_semimajor, display_periapsis_argument, display_inclination, display_longitude, display_res];

	if (!orbit_desc.every((item, index) => {
		return item === new_orbit_desc[index]
	})) {
		new_orbit();
		orbit_desc = new_orbit_desc;
	}
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
}

animate();

function plot_orbit(eccentricity, semimajor, periapsis_arg, inclination, longitude, resolution) {
	let points = [];
	for (let angle = 0; angle < (2 * Math.PI); angle += resolution) {
		let pos = plot_orbit_point(angle, eccentricity, semimajor, periapsis_arg, inclination, longitude);
		points.push(pos);
	}
	return points;
}

function plot_orbit_point(true_anomaly = display_true_anomaly, eccentricity = display_eccentricity, semimajor_axis = display_semimajor, periapsis_arg = display_periapsis_argument, inclination = display_inclination, longitude = display_longitude) {
	const semi_latus_rectum = semimajor_axis * (1 - Math.pow(eccentricity, 2))

	let r = semi_latus_rectum / (1 + eccentricity * Math.cos(true_anomaly));
	let x = r * Math.cos(true_anomaly);
	let y = r * Math.sin(true_anomaly);

	let pos = new THREE.Vector3(x, y, 0);

	let image = to_equatorial(pos, periapsis_arg, inclination, longitude);

	return image;
}
function r(true_anomaly = display_true_anomaly, eccentricity = display_eccentricity, semimajor_axis = display_semimajor, periapsis_arg = display_periapsis_argument, inclination = display_inclination, longitude = display_longitude) {
	const semi_latus_rectum = semimajor_axis * (1 - Math.pow(eccentricity, 2))
	return semi_latus_rectum / (1 + eccentricity * Math.cos(true_anomaly));
}

function orbit_point_velocity(orbital_parameter, true_anomaly = display_true_anomaly, eccentricity = display_eccentricity, semimajor_axis = display_semimajor, periapsis_arg = display_periapsis_argument, inclination = display_inclination, longitude = display_longitude) {
	const semi_latus_rectum = semimajor_axis * (1 - Math.pow(eccentricity, 2));
	const coefficient = Math.sqrt(orbital_parameter / semi_latus_rectum);

	x = -coefficient * Math.sin(true_anomaly);
	y = coefficient * (eccentricity + Math.cos(true_anomaly));
	let velocity = new THREE.Vector3(x, y, 0);
	velocity = to_equatorial(velocity, periapsis_arg, inclination, longitude);

	return velocity;
}

function to_equatorial(pos, periapsis_arg, inclination, longitude) {
	let image = pos.applyAxisAngle(new THREE.Vector3(0, 0, 1), periapsis_arg);
	image.applyAxisAngle(new THREE.Vector3(0, 1, 0), inclination);
	image.applyAxisAngle(new THREE.Vector3(0, 0, 1), longitude)

	return image;
}

function new_orbit() {
	scene.remove(scene.getObjectById(orbit.id));
	orbit_points = plot_orbit(display_eccentricity, display_semimajor, display_periapsis_argument, display_inclination, display_longitude, display_res);
	orbit_geo = new THREE.BufferGeometry().setFromPoints(orbit_points);
	orbit = new THREE.LineLoop(orbit_geo, orbit_mat);
	scene.add(orbit);
	satellite.position.copy(plot_orbit_point());
	arrowVectors = getArrowVectors();
	arrow.setDirection(arrowVectors[0]);
	arrow.position.copy(arrowVectors[1]);
	apsides_line_points = [plot_orbit_point(0), plot_orbit_point(Math.PI)];
	apsides_line_geo = new THREE.BufferGeometry().setFromPoints(apsides_line_points);
	apsides_line.geometry = apsides_line_geo;	
}

function getCenter(eccentricity = display_eccentricity, semimajor_axis = display_semimajor, periapsis_arg = display_periapsis_argument, inclination = display_inclination, longitude = display_longitude) {
	const x = -1 * eccentricity * semimajor_axis;
	return to_equatorial(new THREE.Vector3(x, 0, 0), periapsis_arg, inclination, longitude);
}

function getArrowVectors() {
	const point1 = plot_orbit_point(1.5 * Math.PI / 2);
	const point2 = plot_orbit_point(1.5 * Math.PI / 2 + 0.3)
	
	const dir_x = point2.x - point1.x;
	const dir_y = point2.y - point1.y;
	const dir_z = point2.z - point1.z;
	const org = point1.clone().multiplyScalar(1.1);

	const dir = new THREE.Vector3(dir_x, dir_y, dir_z);
	dir.normalize();
	return [dir, org];
}

function init() {
	const input_value_display = function(element_tag, value) {
		Array.from(document.getElementsByClassName(element_tag + '-display')).forEach((element) => {
			element.innerText = value;
		});
		updateAnomalies();
	}
	
	document.getElementById('true-anomaly').addEventListener('input', (event) => {
		display_true_anomaly = THREE.MathUtils.degToRad(parseFloat(event.target.value));
		input_value_display(event.target.id, parseFloat(event.target.value).toFixed(1));
	})
	document.getElementById('periapsis-argument').addEventListener('input', (event) => {
		display_periapsis_argument = THREE.MathUtils.degToRad(parseFloat(event.target.value));
		if (document.getElementById('eccentricity').value == 0) {
			input_value_display(event.target.id, 'Undef');			
		} else {
			input_value_display(event.target.id, event.target.value);
		}
	})
	document.getElementById('inclination').addEventListener('input', (event) => {
		const grade = document.getElementById('grade');
		display_inclination = THREE.MathUtils.degToRad(parseFloat(event.target.value));
		input_value_display(event.target.id, event.target.value);
		if (event.target.value == 90.0) {
			grade.style.color = 'white';
			grade.innerHTML = 'polar';
		}
		else if (event.target.value < 90) {
			grade.style.color = 'green';
			grade.innerHTML = 'prograde';
		}
		else {
			grade.style.color = 'orange';
			grade.innerHTML = 'retrograde';
		}
			document.getElementById('longitude').dispatchEvent(new Event('input'));
	})
	document.getElementById('longitude').addEventListener('input', (event) => {
		
		if (document.getElementById('inclination').value % 180 == 0) {
			input_value_display(event.target.id, 'Undef');
			display_longitude = 0;
		} else {
			display_longitude = THREE.MathUtils.degToRad(parseFloat(event.target.value));
			input_value_display(event.target.id, event.target.value);
		}
	})
	document.getElementById('eccentricity').addEventListener('input', (event) => {
		display_eccentricity = parseFloat(event.target.value);
		input_value_display(event.target.id, event.target.value);
		document.getElementById('periapsis-argument').dispatchEvent(new Event('input'));
	})
	document.getElementById('semi-major').addEventListener('input', (event) => {
		display_semimajor = parseFloat(event.target.value);
		input_value_display(event.target.id, event.target.value);
	})

	Array.from(document.getElementsByClassName('def')).forEach( (d) => {
		d.addEventListener('click', (event) => {
			definitionPopup(event.target.innerHTML.toString().toLowerCase());
	})}) 
	document.getElementById('popup-close').addEventListener('click', () => {
		Array.from(document.getElementsByClassName('popup')).forEach( (box) => {
			box.classList.remove('popup-show');
		})
	})
}
function updateAnomalies(true_anomaly = display_true_anomaly, eccentricity = display_eccentricity) {

	let eccentric_anomaly = Math.atan2((Math.sqrt(1 - Math.pow(eccentricity, 2)) * Math.sin(true_anomaly)) / (1 + eccentricity * Math.cos(true_anomaly)), (eccentricity + Math.cos(true_anomaly)) / (1 + eccentricity * Math.cos(true_anomaly)));

	let mean_anomaly = eccentric_anomaly - eccentricity * Math.sin(eccentric_anomaly);

	if (Math.abs(true_anomaly) > Math.PI) {
		const correction = (true_anomaly > 0) ? 2 * Math.PI : -2 * Math.PI;
		eccentric_anomaly += correction;
		mean_anomaly += correction;
	}

	drawAnomalies(true_anomaly, eccentric_anomaly, mean_anomaly);

	Array.from(document.getElementsByClassName('eccentric-anomaly-display')).forEach( (element) => {
		element.innerText = THREE.MathUtils.radToDeg(eccentric_anomaly).toFixed(1);
	})
	Array.from(document.getElementsByClassName('mean-anomaly-display')).forEach( (element) => {
		element.innerText = THREE.MathUtils.radToDeg(mean_anomaly).toFixed(1);
	})
}
function drawAnomalies(true_anomaly = display_true_anomaly, eccentric_anomaly, mean_anomaly, eccentricity = display_eccentricity, semimajor_axis = display_semimajor, periapsis_arg = display_periapsis_argument, inclination = display_inclination, longitude = display_longitude) {
	const center = getCenter(eccentricity, semimajor_axis, periapsis_arg, inclination, longitude);

	while (scene.getObjectByName('anomaly_line')) {
		scene.remove(scene.getObjectByName('anomaly_line'));
	}

	[[true_anomaly, 0xdd0000, r(), false], [eccentric_anomaly, 0xffc0cb, semimajor_axis, true], [mean_anomaly, 0x00dd00, semimajor_axis, true]].forEach( (item) => {
		let mat = new THREE.LineDashedMaterial({color: item[1], linewidth: 1, gapsize: 4, dashsize: 5, scale: 1});

		let point1 = item[3] ? center : new THREE.Vector3(0, 0, 0);
		let point2 = to_equatorial(new THREE.Vector3(item[2] * Math.cos(item[0]), item[2] * Math.sin(item[0]), 0), periapsis_arg, inclination, longitude);
		let geo = new THREE.BufferGeometry().setFromPoints([point1, point2]);

		let object = new THREE.Line(geo, mat);
		object.name = 'anomaly_line';

		scene.add(object);

	})
}

const def_content = new Map();
def_content.set('true anomaly', {
	term: 'true anomaly',
	symbol: '&nu;',
	definition: 'The true anomaly ({&nu;}, {<i>f</i>}, or {&theta;}) describes the location of the satellite in the orbital plane at a specific time. It is defined as the angular displacement from the periapsis to the position vector of the satellite, as measured in the direction of motion from the perspective of the primary focus.[2] @@ Circular orbits (where the eccentricity is 0) lack a periapsis; thus the true anomaly is undefined for circular orbits.[2]'
});
def_content.set('mean anomaly', {
	term: 'mean anomaly',
	symbol: '<i>M</i>',
	definition: 'Mean anomaly, {<i>M</i>}, is a mathematically convenient angle used in the calculation of true anomaly with respect to time. While true anomaly changes at a varying rate with time, mean anomaly increases at a constant rate with respect to time.[1] Accordingly, {<i>M</i>}&nbsp;=&nbsp;<sup>2&pi;</sup>/<sub>{T}</sub>&nbsp;&centerdot;&nbsp;{<i>t</i>}, where {T} is the period of the orbit.[1] @@ To relate {<i>M</i>} to true anomaly, an intermediary angle is used: the eccentric anomaly, {<i>E</i>}. This relation is as follows: {<i>M</i>} = {<i>E</i>} - {<i>e</i>} &centerdot; sin {<i>E</i>}. It is implemented here by use of this equation, which is known as Kepler\'s Equation.[1]'
});
def_content.set('eccentric anomaly', {
	term: 'eccentric anomaly',
	symbol: '<i>E</i>',
	definition: 'Eccentric anomaly, {<i>E</i>}, is a mathematically convenient angle used to relate true anomaly to mean anomaly. @@ Consider a concentric auxiliary circle of radius {<i>a</i>} circumscribed around the ellipse. Draw a line from the satellite to perpendicularly intersect the line of apsides. Extend it upwards to intersect the auxillary circle. Angle {<i>E</i>} is the angle between this intersection with the auxillary circle and the periapsis, as measured at the center of the ellipse.[1] @@ It is implemented here with the following equation: @@     <math display="block"><mi>E</mi><mo>=</mo><mn>2</mn><mi>arctan</mi><mo>(</mo><mroot><mfrac><mrow><mn>1</mn><mo>&minus;</mo><mi>e</mi></mrow><mrow><mn>1</mn><mo>&plus;</mo><mi>e</mi></mrow></mfrac><mn>2</mn></mroot><mi>tan</mi><mfrac><mi>&nu;</mi><mn>2</mn></mfrac><mo>)</mo></math>'
});
def_content.set('eccentricity', {
	term: 'eccentricity',
	symbol: '<i>e</i>',
	definition: 'Eccentricity, {<i>e</i>}, measures the divergence of a conic section from a perfect circle.[2] It describes the shape of an orbit. @@ An eccentricity of 0 corresponds to a perfect circle. When {e} < 1 and {e} &ge; 0, the orbit is an ellipse.'
});
def_content.set('periapsis argument', {
	term: 'argument of periapsis',
	symbol: '&omega;',
	definition: 'The argument of periapsis, {&omega;} is the angular displacement of the periapsis from the ascending node (where the orbital plane intersects the equatorial plane).[2] It indicates the orientation of periapsis. @@ In a circular orbit (with an eccentricity of 0), the argument of periapsis is undefined.[2] @@ This angle is the first rotation applied in the process of the transformation from the perifocal frame of reference to the geocentric frame of reference (which is how it is implemented here).[1]'
});
def_content.set('inclination', {
	term: 'inclination',
	symbol: '<i>i</i>',
	definition: 'Inclination, {<i>i</i>}, describes the tilt of the orbital plane. It is the angle at which the orbital plane intersects the equatorial plane of the main body (the node line).[1][2] @@ The inclination ranges from 0&deg; to 180&deg; inclusive. When {<i>i</i>} < 90&deg;, the orbit is direct or prograde orbit - the satellite travels with the rotation of the primary body. If {<i>i</i>} > 180&deg;, it is a retrograde orbit, and the satellite travels against the rotation of the primary body. Orbits with an inclination of 90&deg; are considered to be polar orbits.[2] @@ If {<i>i</i>} is 0&deg; or 180&deg;, then the orbit lies wholly in the equatorial plane and is called an equatorial orbit.[2] @@ Inclination is the second angle applied in the transformation from the perifocal frame of reference to the geocentric frame of reference (which is how it is implemented here).[1]'
});
def_content.set('longitude', {
	term: 'longitude of the node',
	symbol: '&Omega;',
	definition: 'The right ascension of the ascending node, {&Omega;}, is the angle between the ascending node and a reference longitude (in this case the periapsis before transformations are applied). The ascending node, {&#9738;}, is the point on the equatorial plane where the satellite crosses it from north to south. [2] @@ {&Omega;} is undefined in equatorial orbits (with an inclination of 0&deg; or 180&deg;).[2] @@ The right ascension of the ascending node is the third and final angle applied in the transformation from the perifocal frame of reference to the geocentric frame of reference (which is how it is implemented here).[1]'
});
def_content.set('semi-major axis', {
	term: 'semi-major axis',
	symbol: '<i>a</i>',
	definition: 'The semi-major axis, {<i>a</i>}, is half the length of the major axis of an elliptical orbit. It is also equal to half the sum of the altitude at periapsis and apoapsis.[1]'
});

function definitionPopup(term) {
	if (term.includes('prograde') || term.includes('polar') || term.includes('retrograde')) {
		term = 'inclination';
	}
	
	const content = def_content.get(term);
	const reference_prefix = '<sup>[<a target="_blank" href="/references.html#';
	const reference_postfix = '</a>]</sup>';

	document.getElementById('def-title').innerHTML = `${content.term} <span class="def-symbol">${content.symbol}</span>`;
	let bodytext = content.definition.replaceAll('@', '<br>');
	bodytext = bodytext.replaceAll('[1]', reference_prefix + 'one">1' + reference_postfix).replaceAll('[2]', reference_prefix + 'two">2' + reference_postfix);
	bodytext = bodytext.replaceAll('{', '<span class="symbol">').replaceAll('}', '</span>');
	document.getElementById('def-desc').innerHTML = bodytext;

	Array.from(document.getElementsByClassName('popup')).forEach( (box) => {
		box.classList.add('popup-show');
	})
}