import * as THREE from 'three';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const DEFAULT_periapsis_argument = 0,
	DEFAULT_inclination = Math.PI / 4,
	DEFAULT_longitude = 0,
	DEFAULT_eccentricity = 0.5,
	DEFAULT_semimajor_axis = 10,
	default_resolution = 0.05;

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

export class Orbit {
	resolution = default_resolution;
	color = 0x0000ff;
	apsidesLineColor = 0xaaaa00;
	arrowColor = 0xffff00;
	satellites = [];

	constructor(eccentricity, semimajor_axis, periapsis_argument, inclination, longitude) {
		this.eccentricity = eccentricity;
		this.semimajor_axis = semimajor_axis;
		this.periapsis_argument = periapsis_argument;
		this.inclination = inclination;
		this.longitude = longitude;
	}
	drawInitial(resolution = this.resolution) {
		this.orbitObject = this.drawOrbit(resolution);
		this.apsidesLine = this.drawApsidesLine();
		this.arrowObject = this.drawArrow();

		const satelliteObjects = [];
		this.satellites.forEach( (satellite) => {
			satelliteObjects.push(...satellite.drawInitial());
		})
		console.log(satelliteObjects);
		return [this.orbitObject, this.apsidesLine, this.arrowObject, ...satelliteObjects];
	}
	update(resolution = this.resolution) {
		const orbitGeometry = new THREE.BufferGeometry().setFromPoints(this.plot(resolution));
		this.orbitObject.geometry.copy(orbitGeometry);
		orbitGeometry.dispose();
		
		const apsidesLinePoints = [this.plotPoint(0), this.plotPoint(Math.PI)];
		const apsides_geo = new THREE.BufferGeometry().setFromPoints(apsidesLinePoints);
		this.apsidesLine.geometry.copy(apsides_geo);
		apsides_geo.dispose();
		
		const arrow_vectors = this.getArrowVectors();
		this.arrowObject.setDirection(arrow_vectors.direction);
		this.arrowObject.position.copy(arrow_vectors.origin);

		this.satellites.forEach( (satellite) => {
			satellite.update();
		})
	}
	drawOrbit(resolution = this.resolution) {
		
		const points = this.plot();
		points.push(points[0]);
		
		const material = new THREE.LineBasicMaterial({color: this.color, linewidth: 4});
		const geometry = new THREE.BufferGeometry().setFromPoints(points);
		const object = new THREE.LineLoop(geometry, material);
		object.name = 'orbit';

		return object;
	}
	drawApsidesLine() {
		const material = new THREE.LineDashedMaterial({color: this.apsidesLineColor, linewidth: 1, gapsize: 4, dashsize: 5, scale: 1});
		const points = [this.plotPoint(0), this.plotPoint(Math.PI)];
		const geometry = new THREE.BufferGeometry().setFromPoints(points);
		const object = new THREE.Line(geometry, material);
		object.name = 'apsides-line';

		return object;
	}
	drawArrow() {
		const vectors = this.getArrowVectors();
		const arrow = new THREE.ArrowHelper(vectors.direction, vectors.origin, 3, this.arrowColor);

		return arrow;
	}
	getArrowVectors() {
		const point1 = this.plotPoint(1.5 * Math.PI / 2);
		const point2 = this.plotPoint(1.5 * Math.PI / 2 + 0.3)
		
		const dir_x = point2.x - point1.x;
		const dir_y = point2.y - point1.y;
		const dir_z = point2.z - point1.z;
		const org = point1.clone().multiplyScalar(1.1);
	
		const dir = new THREE.Vector3(dir_x, dir_y, dir_z);
		dir.normalize();
		return {direction: dir, origin: org};
	}
	plot(res = this.resolution) {
		let points = [];
		for (let angle = 0; angle < (2 * Math.PI); angle += res) {
			let point = this.plotPoint(angle);
			points.push(point);
		}
		return points;
	}
	plotPoint(true_anomaly) {
		let r = this.getRadius(true_anomaly),
			x = r * Math.cos(true_anomaly),
			y = r * Math.sin(true_anomaly);
		
		let point = new THREE.Vector3(x, y, 0);

		return this.toEquatorial(point);
	}
	getRadius(true_anomaly) {
		const semi_latus_rectum = this.semimajor_axis * (1 - Math.pow(this.eccentricity, 2));
		return semi_latus_rectum / (1 + this.eccentricity * Math.cos(true_anomaly));
	}
	toEquatorial(preimage) {
		let image = preimage.applyAxisAngle(new THREE.Vector3(0, 0, 1), this.periapsis_argument);
		image.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.inclination);
		image.applyAxisAngle(new THREE.Vector3(0, 0, 1), this.longitude);

		return image;
	}
	getEccentricAnomaly(true_anomaly) {
		let eccentric_anomaly = Math.atan2((Math.sqrt(1 - Math.pow(this.eccentricity, 2)) * Math.sin(true_anomaly)) / (1 + this.eccentricity * Math.cos(true_anomaly)), (this.eccentricity + Math.cos(true_anomaly)) / (1 + this.eccentricity * Math.cos(true_anomaly)));
		eccentric_anomaly += this.#getAnomalyCorrection(true_anomaly);

		return eccentric_anomaly;
	}
	getMeanAnomaly(true_anomaly) {
		const eccentric_anomaly = this.getEccentricAnomaly(true_anomaly) - this.#getAnomalyCorrection(true_anomaly);
		let mean_anomaly = eccentric_anomaly - this.eccentricity * Math.sin(eccentric_anomaly);
		mean_anomaly += this.#getAnomalyCorrection(true_anomaly);

		return mean_anomaly;
	}
	#getAnomalyCorrection(true_anomaly) {
		if (Math.abs(true_anomaly) > Math.PI) {
			return (true_anomaly > 0) ? 2 * Math.PI : -2 * Math.PI;
		}
		return 0;
	}
	getCenter() {
		const centerX = -1 * this.eccentricity * this.semimajor_axis; // x coord of center in perifocal frame
		return this.toEquatorial(new THREE.Vector3(centerX, 0, 0));
	}
}

export class Satellite {
	color = 0xff0000;
	trueAnomalyColor = 0xdd0000;
	eccentricAnomalyColor = 0xffc0cb;
	meanAnomalyColor = 0x00dd00;
	size = 0.15; // radius of satellite
	trueAnomaly = 0;
	parentOrbit;

	constructor(parent_orbit, initial_true_anomaly = this.trueAnomaly) {
		this.parentOrbit = parent_orbit;
		this.parentOrbit.satellites.push(this);

		this.trueAnomaly = initial_true_anomaly;
	}
	drawInitial() {
		this.satelliteObject = this.drawSatellite();
		this.drawAnomalies().forEach( (item) => {
			this[`${item.name}AnomalyObject`] = item;
		})
		
		return [this.satelliteObject, this.trueAnomalyObject, this.eccentricAnomalyObject, this.meanAnomalyObject]
	}
	update() {
		this.satelliteObject.position.copy(this.getPosition);

		this.trueAnomalyObject.geometry = new THREE.BufferGeometry().setFromPoints(this.plotTrueAnomaly());
		this.eccentricAnomalyObject.geometry = new THREE.BufferGeometry().setFromPoints(this.plotEccentricAnomaly());
		this.meanAnomalyObject.geometry = new THREE.BufferGeometry().setFromPoints(this.plotMeanAnomaly());

	}
	drawSatellite() {
		const material = new THREE.MeshBasicMaterial({color: this.color});
		const geometry = new THREE.OctahedronGeometry(this.size, 3);
		geometry.name = 'satellite geo';
		const object = new THREE.Mesh(geometry, material);
		object.name = 'satellite';

		object.position.copy(this.getPosition());

		return object;
	}
	getPosition() {
		return this.parentOrbit.plotPoint(this.trueAnomaly);
	}
	getEccentricAnomaly() {
		return this.parentOrbit.getEccentricAnomaly(this.trueAnomaly);
	}
	getMeanAnomaly() {
		return this.parentOrbit.getMeanAnomaly(this.trueAnomaly);
	}
	plotTrueAnomaly() {
		const point1 = new THREE.Vector3(0, 0, 0);
		const point2 = this.getPosition();
		return [point1, point2];
	}
	plotEccentricAnomaly() {
		const eccentric_anomaly = this.getEccentricAnomaly();
		const semimajor_axis = this.parentOrbit.semimajor_axis;
		
		const point1 = this.parentOrbit.getCenter();
		const point2 = this.parentOrbit.toEquatorial(new THREE.Vector3(
			semimajor_axis * Math.cos(eccentric_anomaly),
			semimajor_axis * Math.sin(eccentric_anomaly),
			0));
		return [point1, point2];
	}
	plotMeanAnomaly() {
		const mean_anomaly = this.getMeanAnomaly();
		const semimajor_axis = this.parentOrbit.semimajor_axis;

		const point1 = this.parentOrbit.getCenter();
		const point2 = this.parentOrbit.toEquatorial(new THREE.Vector3(
			semimajor_axis * Math.cos(mean_anomaly),
			semimajor_axis * Math.sin(mean_anomaly),
			0));
		return [point1, point2];
	}
	drawAnomalies() {
		let objects = [];
		[
			[this.plotTrueAnomaly(), this.trueAnomalyColor, 'true'],
			[this.plotEccentricAnomaly(), this.eccentricAnomalyColor, 'eccentric'],
			[this.plotMeanAnomaly(), this.meanAnomalyColor, 'mean']
		].forEach( (anomaly) => {
			const material = new THREE.LineDashedMaterial({color: anomaly[1], linewidth: 1, scale: 1});
			const geometry = new THREE.BufferGeometry().setFromPoints(anomaly[0]);
			geometry.name = anomaly[2];

			const object = new THREE.Line(geometry, material);
			object.name = anomaly[2];

			objects.push(object);
		})
		return objects;
	}
}


export const orbit = new Orbit(DEFAULT_eccentricity, DEFAULT_semimajor_axis, DEFAULT_periapsis_argument, DEFAULT_inclination, DEFAULT_longitude);
export const satellite = new Satellite(orbit);

scene.add(...orbit.drawInitial());

let previous_params = [satellite.trueAnomaly, orbit.eccentricity, orbit.semimajor_axis, orbit.periapsis_argument, orbit.inclination, orbit.longitude];
function animate() {
	
	controls.update();
	
	let current_params = [satellite.trueAnomaly, orbit.eccentricity, orbit.semimajor_axis, orbit.periapsis_argument, orbit.inclination, orbit.longitude]
	if (!current_params.every( (element, index) => {
		return element === previous_params[index];
	})) {
		previous_params = current_params;
		orbit.update();
		updateAnomalyDisplays();
	}

	requestAnimationFrame(animate);
	renderer.render(scene, camera);

	function updateAnomalyDisplays() {
		const eccentric_anomaly = satellite.getEccentricAnomaly();
		Array.from(document.getElementsByClassName('eccentric-anomaly-display'))
			.forEach( (element) => {
				element.innerHTML = THREE.MathUtils.radToDeg(eccentric_anomaly).toFixed(1);
			})
		const mean_anomaly = satellite.getMeanAnomaly();
		Array.from(document.getElementsByClassName('mean-anomaly-display'))
			.forEach( (element) => {
				element.innerHTML = THREE.MathUtils.radToDeg(mean_anomaly).toFixed(1);
			})
	}
}

animate();

function init() {
	const input_value_display = function(element_tag, value) {
		Array.from(document.getElementsByClassName(element_tag + '-display')).forEach((element) => {
			element.innerText = value;
		});
	}

	document.getElementById('true-anomaly').addEventListener('input', (event) => {
		satellite.trueAnomaly = THREE.MathUtils.degToRad(parseFloat(event.target.value));
		input_value_display(event.target.id, parseFloat(event.target.value).toFixed(1));
	})
	document.getElementById('periapsis-argument').addEventListener('input', (event) => {
		orbit.periapsis_argument = THREE.MathUtils.degToRad(parseFloat(event.target.value));
		if (document.getElementById('eccentricity').value == 0) {
			input_value_display(event.target.id, 'Undef');			
		} else {
			input_value_display(event.target.id, event.target.value);
		}
	})
	document.getElementById('inclination').addEventListener('input', (event) => {
		const grade = document.getElementById('grade');
		orbit.inclination = THREE.MathUtils.degToRad(parseFloat(event.target.value));
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
			DEFAULT_longitude = 0;
		} else {
			orbit.longitude = THREE.MathUtils.degToRad(parseFloat(event.target.value));
			input_value_display(event.target.id, event.target.value);
		}
	})
	document.getElementById('eccentricity').addEventListener('input', (event) => {
		orbit.eccentricity = parseFloat(event.target.value);
		input_value_display(event.target.id, event.target.value);
		document.getElementById('periapsis-argument').dispatchEvent(new Event('input'));
	})
	document.getElementById('semi-major').addEventListener('input', (event) => {
		orbit.semimajor_axis = parseFloat(event.target.value);
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

export const def_content = new Map();
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

export function definitionPopup(term) {
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
