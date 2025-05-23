import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Settings, Zap, Heart, Users } from 'lucide-react';

const SIM_PARAMS = {
  ORGANISM_MAX_ENERGY: 120,
  CHILD_INITIAL_ENERGY: 60,
  INITIAL_POP_ENERGY_FACTOR: 0.75, 
  REPRODUCTION_THRESHOLD_FACTOR_MIN: 0.40,
  REPRODUCTION_THRESHOLD_FACTOR_MAX: 1.10,
  ENERGY_EFFICIENCY_FACTOR_MIN: 0.7,
  ENERGY_EFFICIENCY_FACTOR_MAX: 1.4,
  REPRODUCTION_SPEED_FACTOR_MIN: 0.8,
  REPRODUCTION_SPEED_FACTOR_MAX: 1.2,
  LIFESPAN_BASE: 4500,
  LIFESPAN_RANDOM_ADD: 2500, 
  SIZE_MIN: 3,
  SIZE_MAX: 9,
  SPEED_MIN: 0.5,
  SPEED_MAX: 2.0,
  SENSOR_RANGE_MIN: 30,
  SENSOR_RANGE_MAX: 80, 
  TOXIN_RESISTANCE_MIN: 0.2,
  TOXIN_RESISTANCE_MAX: 0.8,
  BASE_REPRODUCTION_COOLDOWN: 200,
  MIN_REPRODUCTION_AGE: 50,
  REPRODUCTION_ENERGY_COST_FACTOR: 0.15,
  METABOLIC_RATE_BASE: 0.08,
  SIZE_COST_FACTOR: 0.01,
  ENVIRONMENTAL_STRESS_IMPACT_MULTIPLIER: 0.01, 
  TEMPERATURE_OPTIMUM: 0.5,
  TEMPERATURE_STRESS_FACTOR: 0.1, 
  TOXIN_DAMAGE_FACTOR: 0.01, 
  FOOD_ENERGY_GAIN: 65,
  MUTATION_RATE: 0.06,
};

const EvolutionSimulation = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [isRunning, setIsRunning] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [population, setPopulation] = useState([]);
  const [environmentalFactors, setEnvironmentalFactors] = useState({
    temperature: SIM_PARAMS.TEMPERATURE_OPTIMUM,
    toxicity: 0.05,
    foodAbundance: 0.8
  });
  const [stats, setStats] = useState({
    avgSize: 0,
    avgSpeed: 0,
    avgEnergy: 0,
    species: 0,
    totalBorn: 0,
    totalDied: 0
  });

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const MAX_POPULATION = 500;
  const INITIAL_POPULATION = 50;
  const FOOD_COUNT = 150;

  const environmentRef = useRef({
    food: [],
    toxins: [],
    temperature: SIM_PARAMS.TEMPERATURE_OPTIMUM,
    time: 0,
    particles: [],
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
  });

  class Organism {
    constructor(x, y, genome = null, isInitialPopulationMember = false) {
      this.x = x || Math.random() * CANVAS_WIDTH; 
      this.y = y || Math.random() * CANVAS_HEIGHT;
      this.vx = 0;
      this.vy = 0;
      
      this.maxEnergy = SIM_PARAMS.ORGANISM_MAX_ENERGY;
      this.energy = isInitialPopulationMember 
                    ? this.maxEnergy * SIM_PARAMS.INITIAL_POP_ENERGY_FACTOR 
                    : SIM_PARAMS.CHILD_INITIAL_ENERGY;
      
      this.genome = genome || {
        size: SIM_PARAMS.SIZE_MIN + Math.random() * (SIM_PARAMS.SIZE_MAX - SIM_PARAMS.SIZE_MIN),
        speed: SIM_PARAMS.SPEED_MIN + Math.random() * (SIM_PARAMS.SPEED_MAX - SIM_PARAMS.SPEED_MIN),
        energyEfficiencyFactor: SIM_PARAMS.ENERGY_EFFICIENCY_FACTOR_MIN + Math.random() * (SIM_PARAMS.ENERGY_EFFICIENCY_FACTOR_MAX - SIM_PARAMS.ENERGY_EFFICIENCY_FACTOR_MIN),
        reproductionThresholdFactor: SIM_PARAMS.REPRODUCTION_THRESHOLD_FACTOR_MIN + Math.random() * (SIM_PARAMS.REPRODUCTION_THRESHOLD_FACTOR_MAX - SIM_PARAMS.REPRODUCTION_THRESHOLD_FACTOR_MIN),
        reproductionSpeedFactor: SIM_PARAMS.REPRODUCTION_SPEED_FACTOR_MIN + Math.random() * (SIM_PARAMS.REPRODUCTION_SPEED_FACTOR_MAX - SIM_PARAMS.REPRODUCTION_SPEED_FACTOR_MIN),
        lifespan: SIM_PARAMS.LIFESPAN_BASE + Math.random() * SIM_PARAMS.LIFESPAN_RANDOM_ADD,
        aggressiveness: Math.random() * 0.6,
        sociability: Math.random(),
        toxinResistance: SIM_PARAMS.TOXIN_RESISTANCE_MIN + Math.random() * (SIM_PARAMS.TOXIN_RESISTANCE_MAX - SIM_PARAMS.TOXIN_RESISTANCE_MIN),
        sensorRange: SIM_PARAMS.SENSOR_RANGE_MIN + Math.random() * (SIM_PARAMS.SENSOR_RANGE_MAX - SIM_PARAMS.SENSOR_RANGE_MIN),
        hue: Math.random() * 360 
      };
      
      this.reproductionThreshold = this.maxEnergy * this.genome.reproductionThresholdFactor;
      this.age = 0;
      this.reproductionCooldown = 0;
      this.species = this.calculateSpecies();
      this.trail = [];
    }

    calculateSpecies() {
      const g = this.genome;
      return Math.floor((g.size + (g.speed || 0) * 5 + (g.aggressiveness || 0) * 10) % 8);
    }

    update(environment, organisms) {
      this.age++;
      this.reproductionCooldown = Math.max(0, this.reproductionCooldown - 1);
      
      const tempDifference = Math.abs((environment.temperature || SIM_PARAMS.TEMPERATURE_OPTIMUM) - SIM_PARAMS.TEMPERATURE_OPTIMUM);
      const tempStressEffect = tempDifference * SIM_PARAMS.TEMPERATURE_STRESS_FACTOR;
      
      const numNearbyToxins = environment.toxins ? environment.toxins.length : 0; 
      const toxinDamageEffect = numNearbyToxins * (1 - this.genome.toxinResistance) * SIM_PARAMS.TOXIN_DAMAGE_FACTOR;
      
      const environmentalStressTotal = tempStressEffect + toxinDamageEffect;

      let energyConsumed = (
        SIM_PARAMS.METABOLIC_RATE_BASE +
        (this.genome.size * SIM_PARAMS.SIZE_COST_FACTOR) +
        (environmentalStressTotal * SIM_PARAMS.ENVIRONMENTAL_STRESS_IMPACT_MULTIPLIER)
      );

      if (this.genome.energyEfficiencyFactor > 0.01) {
        energyConsumed /= this.genome.energyEfficiencyFactor;
      } else {
        energyConsumed *= 5;
      }
      
      this.energy -= energyConsumed;
      this.behave(environment, organisms);
      
      this.x += this.vx;
      this.y += this.vy;
      
      this.trail.push({ x: this.x, y: this.y, alpha: 1 });
      if (this.trail.length > 15) this.trail.shift();
      this.trail.forEach(point => point.alpha *= 0.9);
      
      this.x = (this.x + environment.canvasWidth) % environment.canvasWidth;
      this.y = (this.y + environment.canvasHeight) % environment.canvasHeight;
      
      this.vx *= 0.92; 
      this.vy *= 0.92;
      
      this.energy = Math.min(this.energy, this.maxEnergy);
    }

    behave(environment, organisms) {
      const foodItems = environment.food || [];
      const toxinItems = environment.toxins || [];
      const otherOrganisms = organisms.filter(o => o !== this);

      const nearbyFood = this.findNearby(foodItems, this.genome.sensorRange);
      const nearbyOrganisms = this.findNearby(otherOrganisms, this.genome.sensorRange);
      const nearbyToxins = this.findNearby(toxinItems, this.genome.sensorRange);
      
      let movedForFood = false;
      if (this.energy < this.reproductionThreshold || this.energy < this.maxEnergy * 0.7) { 
          if (nearbyFood.length > 0) {
              const closest = this.getClosest(nearbyFood);
              if(closest) {
                this.moveTowards(closest.x, closest.y, 1.5); 
                movedForFood = true;
              }
          }
      } else if (nearbyFood.length > 0) {
          const closest = this.getClosest(nearbyFood);
           if(closest) {
            this.moveTowards(closest.x, closest.y, 1.0);
            movedForFood = true;
           }
      }
      
      if (nearbyToxins.length > 0) {
        const closest = this.getClosest(nearbyToxins);
        if (closest) this.moveAway(closest.x, closest.y, 1.2);
      }
      
      if (nearbyOrganisms.length > 0) {
        const sameSpecies = nearbyOrganisms.filter(org => org.species === this.species);
        const differentSpecies = nearbyOrganisms.filter(org => org.species !== this.species);
        
        if (this.genome.sociability > 0.6 && sameSpecies.length > 0) {
          const center = this.getCenter(sameSpecies);
          if(center) this.moveTowards(center.x, center.y, 0.3 * this.genome.sociability);
        }
        
        if (this.genome.aggressiveness > 0.7 && differentSpecies.length > 0) {
          const target = this.getClosest(differentSpecies);
          if (target && this.genome.size > target.genome.size * 1.1 && this.energy > target.energy * 1.2) {
            this.moveTowards(target.x, target.y, 0.5 * this.genome.aggressiveness);
          } else if (target && target.genome.size > this.genome.size * 1.2) { 
            this.moveAway(target.x, target.y, 0.7);
          }
        }
      }
      
      if (!movedForFood && Math.random() < 0.12) {
        this.vx += (Math.random() - 0.5) * 0.35;
        this.vy += (Math.random() - 0.5) * 0.35;
      }

      const maxSpeedFactor = 0.6;
      const maxAchievableSpeed = this.genome.speed * maxSpeedFactor;
      const currentSpeed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
      if (currentSpeed > maxAchievableSpeed) {
          this.vx = (this.vx / currentSpeed) * maxAchievableSpeed;
          this.vy = (this.vy / currentSpeed) * maxAchievableSpeed;
      }
    }

    findNearby(items, range) {
      if (!items) return [];
      return items.filter(item => {
        if (!item || typeof item.x !== 'number' || typeof item.y !== 'number') return false;
        const dx = item.x - this.x;
        const dy = item.y - this.y;
        return (dx * dx + dy * dy) < (range * range);
      });
    }

    getClosest(items) {
      if (!items || items.length === 0) return null;
      let closestItem = null;
      let minDistSq = Infinity;
      
      items.forEach(item => {
        const dx = item.x - this.x;
        const dy = item.y - this.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDistSq) {
          minDistSq = distSq;
          closestItem = item;
        }
      });
      return closestItem;
    }

    getCenter(items) {
      if (!items || items.length === 0) return null; 
      let sumX = 0, sumY = 0;
      items.forEach(item => {
        sumX += item.x;
        sumY += item.y;
      });
      return { x: sumX / items.length, y: sumY / items.length };
    }

    moveTowards(x, y, strength = 1) {
      const dx = x - this.x;
      const dy = y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const accelFactor = 0.08; 
      if (dist > 0.1) {
        this.vx += (dx / dist) * this.genome.speed * strength * accelFactor;
        this.vy += (dy / dist) * this.genome.speed * strength * accelFactor;
      }
    }

    moveAway(x, y, strength = 1) {
      const dx = x - this.x;
      const dy = y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const accelFactor = 0.08;
      if (dist > 0.1) {
        this.vx -= (dx / dist) * this.genome.speed * strength * accelFactor;
        this.vy -= (dy / dist) * this.genome.speed * strength * accelFactor;
      }
    }

    canEat(food) { 
      if(!food) return false;
      const dx = food.x - this.x;
      const dy = food.y - this.y;
      const eatRangeSq = (this.genome.size + 4) * (this.genome.size + 4);
      return (dx * dx + dy * dy) < eatRangeSq; 
    }

    canReproduce() {
      return this.energy > this.reproductionThreshold && 
            this.reproductionCooldown <= 0 && 
            this.age > SIM_PARAMS.MIN_REPRODUCTION_AGE;
    }

    reproduce(partner = null) {
      if (!this.canReproduce()) return null;
      
      this.energy -= this.maxEnergy * SIM_PARAMS.REPRODUCTION_ENERGY_COST_FACTOR;
      this.reproductionCooldown = Math.floor(SIM_PARAMS.BASE_REPRODUCTION_COOLDOWN / (this.genome.reproductionSpeedFactor || 1));
      
      let childGenome = partner && Math.random() < 0.5
                        ? this.crossover(this.genome, partner.genome) 
                        : JSON.parse(JSON.stringify(this.genome));
      
      this.mutate(childGenome);
      
      const angle = Math.random() * Math.PI * 2;
      const distance = (this.genome.size || SIM_PARAMS.SIZE_MIN) + 10;
      const childX = this.x + Math.cos(angle) * distance;
      const childY = this.y + Math.sin(angle) * distance;
      
      return new Organism(childX, childY, childGenome, false); 
    }

    crossover(genome1, genome2) {
      const child = {};
      for (const key in genome1) {
        if (Object.prototype.hasOwnProperty.call(genome1, key)) {
          child[key] = Math.random() < 0.5 ? genome1[key] : (genome2[key] !== undefined ? genome2[key] : genome1[key]);
        }
      }
      return child;
    }

    mutate(genome) { 
      Object.keys(genome).forEach(key => {
        if (Math.random() < SIM_PARAMS.MUTATION_RATE) {
          const mutationAmount = (Math.random() - 0.5) * 0.20; 
          
          switch(key) {
            case 'hue':
              genome[key] = (genome[key] + mutationAmount * 40);
              genome[key] = (genome[key] % 360 + 360) % 360;
              break;
            case 'size':
              genome[key] *= (1 + mutationAmount);
              genome[key] = Math.max(SIM_PARAMS.SIZE_MIN * 0.7, Math.min(SIM_PARAMS.SIZE_MAX * 1.3, genome[key])); 
              break;
            case 'speed':
              genome[key] *= (1 + mutationAmount);
              genome[key] = Math.max(SIM_PARAMS.SPEED_MIN * 0.7, Math.min(SIM_PARAMS.SPEED_MAX * 1.3, genome[key]));
              break;
            case 'energyEfficiencyFactor':
              genome[key] *= (1 + mutationAmount);
              genome[key] = Math.max(SIM_PARAMS.ENERGY_EFFICIENCY_FACTOR_MIN * 0.7, Math.min(SIM_PARAMS.ENERGY_EFFICIENCY_FACTOR_MAX * 1.3, genome[key]));
              break;
            case 'reproductionSpeedFactor':
              genome[key] *= (1 + mutationAmount);
              genome[key] = Math.max(SIM_PARAMS.REPRODUCTION_SPEED_FACTOR_MIN * 0.7, Math.min(SIM_PARAMS.REPRODUCTION_SPEED_FACTOR_MAX * 1.3, genome[key]));
              break;
            case 'reproductionThresholdFactor':
              genome[key] *= (1 + mutationAmount);
              genome[key] = Math.max(SIM_PARAMS.REPRODUCTION_THRESHOLD_FACTOR_MIN * 0.7, Math.min(SIM_PARAMS.REPRODUCTION_THRESHOLD_FACTOR_MAX * 1.3, genome[key]));
              break;
            case 'lifespan':
              genome[key] += mutationAmount * SIM_PARAMS.LIFESPAN_RANDOM_ADD * 0.2;
              genome[key] = Math.max(SIM_PARAMS.LIFESPAN_BASE * 0.5, genome[key]);
              break;
            case 'toxinResistance':
               genome[key] *= (1 + mutationAmount);
               genome[key] = Math.max(SIM_PARAMS.TOXIN_RESISTANCE_MIN*0.7, Math.min(SIM_PARAMS.TOXIN_RESISTANCE_MAX*1.3, genome[key]));
               break;
            case 'sensorRange':
               genome[key] *= (1 + mutationAmount);
               genome[key] = Math.max(SIM_PARAMS.SENSOR_RANGE_MIN*0.7, Math.min(SIM_PARAMS.SENSOR_RANGE_MAX*1.3, genome[key]));
               break;
            case 'aggressiveness':
            case 'sociability':
              genome[key] += mutationAmount;
              genome[key] = Math.max(0, Math.min(1, genome[key]));
              break;
            default:
              break;
          }
        }
      });

      genome.size = Math.max(SIM_PARAMS.SIZE_MIN * 0.5, Math.min(SIM_PARAMS.SIZE_MAX * 1.5, Number.isFinite(genome.size) ? genome.size : SIM_PARAMS.SIZE_MIN));
      genome.speed = Math.max(SIM_PARAMS.SPEED_MIN * 0.5,Math.min(SIM_PARAMS.SPEED_MAX * 1.5, Number.isFinite(genome.speed) ? genome.speed : SIM_PARAMS.SPEED_MIN));
      genome.energyEfficiencyFactor = Math.max(0.1, Number.isFinite(genome.energyEfficiencyFactor) ? genome.energyEfficiencyFactor : SIM_PARAMS.ENERGY_EFFICIENCY_FACTOR_MIN);
      genome.reproductionSpeedFactor = Math.max(0.1, Number.isFinite(genome.reproductionSpeedFactor) ? genome.reproductionSpeedFactor : SIM_PARAMS.REPRODUCTION_SPEED_FACTOR_MIN);
      genome.reproductionThresholdFactor = Math.max(SIM_PARAMS.REPRODUCTION_THRESHOLD_FACTOR_MIN * 0.5, Math.min(SIM_PARAMS.REPRODUCTION_THRESHOLD_FACTOR_MAX * 1.5, Number.isFinite(genome.reproductionThresholdFactor) ? genome.reproductionThresholdFactor : SIM_PARAMS.REPRODUCTION_THRESHOLD_FACTOR_MIN));
      genome.lifespan = Math.max(SIM_PARAMS.LIFESPAN_BASE * 0.3, Number.isFinite(genome.lifespan) ? genome.lifespan : SIM_PARAMS.LIFESPAN_BASE);
    }

    isDead() {
      return this.energy <= 0 || this.age > (this.genome.lifespan || SIM_PARAMS.LIFESPAN_BASE);
    }

    draw(ctx) {
      const g = this.genome;
      const safeRadius = r => (Number.isFinite(r) && r > 0.1 ? r : 1); 
      const bodyRadius = safeRadius(g.size);

      this.trail.forEach((point, i) => {
        if (point.alpha > 0.05) { 
          const trailSize = safeRadius(bodyRadius * 0.25) * point.alpha;
          const trailHue = (g.hue + i * 6) % 360; 
          ctx.fillStyle = `hsla(${trailHue}, 60%, 55%, ${point.alpha * 0.3})`;
          ctx.beginPath();
          ctx.arc(point.x, point.y, trailSize, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      
      const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, bodyRadius);
      gradient.addColorStop(0, `hsl(${g.hue}, 85%, 75%)`); 
      gradient.addColorStop(0.6, `hsl(${g.hue}, 70%, 60%)`);
      gradient.addColorStop(1, `hsl(${g.hue}, 50%, 40%)`); 
      
      ctx.fillStyle = gradient;
      ctx.shadowColor = `hsla(${g.hue}, 90%, 70%, 0.7)`;
      ctx.shadowBlur = bodyRadius * 0.5;
      
      ctx.beginPath();
      ctx.arc(this.x, this.y, bodyRadius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 0;
      
      const energyRatio = Math.max(0, this.energy / this.maxEnergy);
      if (energyRatio < 0.65) { 
        ctx.strokeStyle = `rgba(255, ${Math.floor(energyRatio * 255 * 1.8)}, 0, 0.75)`; 
        ctx.lineWidth = Math.max(1, bodyRadius * 0.12); 
        ctx.beginPath();
        ctx.arc(this.x, this.y, bodyRadius + ctx.lineWidth * 0.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * energyRatio);
        ctx.stroke();
      }
      
      const speciesIndicatorSize = safeRadius(bodyRadius * 0.33 + Math.sin(this.age * 0.05) * (bodyRadius * 0.05)); 
      ctx.fillStyle = `hsla(${this.species * 45}, 95%, 85%, 0.95)`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, speciesIndicatorSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `hsla(${this.species * 45}, 95%, 50%, 0.9)`;
      ctx.lineWidth = Math.max(0.5, bodyRadius * 0.03);
      ctx.stroke(); 
    }
  }

  const initializeSimulation = useCallback(() => {
    const newPopulation = [];
    for (let i = 0; i < INITIAL_POPULATION; i++) {
      newPopulation.push(new Organism(null, null, null, true));
    }
    
    environmentRef.current = {
      food: [],
      toxins: [],
      temperature: SIM_PARAMS.TEMPERATURE_OPTIMUM,
      time: 0,
      particles: [],
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT,
    };
    
    for (let i = 0; i < FOOD_COUNT; i++) {
      environmentRef.current.food.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        age: 0
      });
    }
    
    setPopulation(newPopulation);
    setGeneration(0);
    setStats(prev => ({ 
        ...prev, 
        totalBorn: INITIAL_POPULATION, 
        totalDied: 0,
        avgSize: 0,
        avgSpeed: 0,
        avgEnergy: 0,
        species: 0,
    }));
  }, []);

  const updateEnvironment = () => {
    const env = environmentRef.current;
    env.time++;
    env.temperature = SIM_PARAMS.TEMPERATURE_OPTIMUM + 0.2 * Math.sin(env.time * 0.0005);
    
    if (env.food.length < FOOD_COUNT * 1.5 && Math.random() < (environmentalFactors.foodAbundance || 0.8) * 0.10) {
      env.food.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        age: 0
      });
    }
    
    env.food = env.food.filter(f => {
        f.age++;
        return f.age < 1500;
    });
    
    if (Math.random() < (environmentalFactors.toxicity || 0.05) * 0.015) {
      env.toxins.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        age: 0
      });
    }
    
    env.toxins = env.toxins.filter(toxin => {
      toxin.age++;
      return toxin.age < 300;
    });
    
    if (Math.random() < 0.3) {
      env.particles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        life: 100,
        hue: Math.random() * 360
      });
    }
    env.particles = env.particles.filter(p => {
      p.x += p.vx; p.y += p.vy; p.life--;
      return p.life > 0;
    });
    
    setEnvironmentalFactors(prev => ({
      ...prev,
      temperature: env.temperature 
    }));
  };

  const simulationStep = useCallback(() => {
    setPopulation(currentPop => {
      if (currentPop.length === 0 && animationRef.current) {
          setIsRunning(false);
          return [];
      }
      if (currentPop.length === 0) return [];
      
      const env = environmentRef.current;
      updateEnvironment();
      
      let bornThisStep = 0;
      let diedThisStep = 0;

      let updatedPop = currentPop.map(org => {
        org.update(env, currentPop);
        return org;
      });
      
      const uneatenFood = [];
      for (const food of env.food) {
        let eaten = false;
        for (const org of updatedPop) {
          if (!org.isDead() && org.canEat(food)) {
            org.energy = Math.min(org.maxEnergy, org.energy + SIM_PARAMS.FOOD_ENERGY_GAIN);
            eaten = true;
            break; 
          }
        }
        if (!eaten) {
          uneatenFood.push(food);
        }
      }
      env.food = uneatenFood;
      
      const newborns = [];
      updatedPop.forEach(org => {
        if (!org.isDead() && org.canReproduce() && (updatedPop.length + newborns.length) < MAX_POPULATION) {
          const nearbyMates = updatedPop.filter(other => 
            !other.isDead() &&
            other !== org && 
            other.species === org.species &&
            (Math.sqrt((other.x - org.x) ** 2 + (other.y - org.y) ** 2) < (org.genome.sensorRange || SIM_PARAMS.SENSOR_RANGE_MIN) * 0.8)
          );
          
          const mate = nearbyMates.length > 0 ? nearbyMates[Math.floor(Math.random() * nearbyMates.length)] : null;
          const child = org.reproduce(mate);
          if (child) {
            newborns.push(child);
            bornThisStep++;
          }
        }
      });
      
      const survivors = updatedPop.filter(org => {
        if (org.isDead()) {
          diedThisStep++;
          return false;
        }
        return true;
      });

      const newPopulation = [...survivors, ...newborns];
      
      if (newPopulation.length > 0) {
        let sumSize = 0, sumSpeed = 0, sumEnergy = 0;
        const speciesSet = new Set();

        newPopulation.forEach(org => {
            sumSize += org.genome.size || 0;
            sumSpeed += org.genome.speed || 0;
            sumEnergy += org.energy || 0;
            speciesSet.add(org.species);
        });
        
        setStats(prev => ({ 
          avgSize: sumSize / newPopulation.length, 
          avgSpeed: sumSpeed / newPopulation.length, 
          avgEnergy: sumEnergy / newPopulation.length, 
          species: speciesSet.size,
          totalBorn: prev.totalBorn + bornThisStep,
          totalDied: prev.totalDied + diedThisStep
        }));
      } else {
         setStats(prev => ({
          avgSize: 0, 
          avgSpeed: 0, 
          avgEnergy: 0, 
          species: 0,
          totalBorn: prev.totalBorn + bornThisStep,
          totalDied: prev.totalDied + diedThisStep
        }));
      }
      
      if (env.time % 500 === 0 && newPopulation.length > 0) {
        setGeneration(prev => prev + 1);
      }
      
      return newPopulation;
    });
  }, [environmentalFactors.foodAbundance, environmentalFactors.toxicity]);

 const animate = useCallback(() => {
    simulationStep();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#0a0a0f');
    gradient.addColorStop(1, '#101018');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const env = environmentRef.current;

    env.particles.forEach(p => {
      const alpha = p.life / 100;
      ctx.fillStyle = `hsla(${p.hue}, 40%, 70%, ${alpha * 0.1})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    env.food.forEach(food => {
      const pulse = Math.sin(env.time * 0.08 + food.x * 0.02 + food.y * 0.01) * 0.3 + 0.7;
      const size = 2.8 + pulse * 0.5;
      ctx.shadowColor = 'rgba(80, 255, 150, 0.25)';
      ctx.shadowBlur = 7;
      ctx.fillStyle = `rgba(80, 255, 150, ${0.55 + pulse * 0.25})`;
      ctx.beginPath();
      ctx.arc(food.x, food.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    env.toxins.forEach(toxin => {
      const pulse = Math.sin(env.time * 0.12 + toxin.x * 0.015) * 0.25 + 0.75;
      const size = 3.0 + Math.sin(env.time * 0.2 + toxin.y * 0.02) * 0.5;
      ctx.shadowColor = 'rgba(255, 50, 80, 0.35)';
      ctx.shadowBlur = 9;
      ctx.fillStyle = `rgba(255, 50, 80, ${pulse * 0.8})`;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 + env.time * 0.02;
          const x_i = toxin.x + Math.cos(angle) * size;
          const y_i = toxin.y + Math.sin(angle) * size;
          if (i === 0) ctx.moveTo(x_i, y_i);
          else ctx.lineTo(x_i, y_i);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    
    population.forEach(org => {
        if (org && typeof org.draw === 'function') {
            org.draw(ctx);
        }
    });
  
    animationRef.current = requestAnimationFrame(animate);
  }, [simulationStep, population]);


  useEffect(() => {
    if (isRunning) {
      animationRef.current = requestAnimationFrame(animate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, animate]);
  
  useEffect(() => {
    initializeSimulation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

    const toggleSimulation = () => {
        setIsRunning(prev => !prev);
    };

    const resetSimulation = () => {
        setIsRunning(false);
        requestAnimationFrame(() => { 
            initializeSimulation();
        });
    };

  return (
    <div className="container" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", backgroundColor: '#08080c', color: '#e0e0e0', minHeight: '100vh', padding: '20px' }}>
      <style>{`
    .container { display: flex; flex-direction: column; align-items: center; gap: 20px; }
    .header { text-align: center; margin-bottom: 10px; }
    .title { font-size: 2.8em; color: #60a5fa; margin-bottom: 0.2em; font-weight: 300; letter-spacing: 1px; }
    .subtitle { font-size: 1.1em; color: #9ca3af; font-weight: 300; }
    .controls { display: flex; gap: 15px; margin-bottom: 20px; }
    .btn { background-color: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; transition: background-color 0.3s; display: flex; align-items: center; gap: 8px; font-size: 1em; }
    .btn:hover { background-color: #1d4ed8; }
    .btn.play { background-color: #10b981; } .btn.play:hover { background-color: #059669; }
    .btn.reset { background-color: #ef4444; } .btn.reset:hover { background-color: #dc2626; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; width: 100%; max-width: 1200px; }
    .card { background-color: #1f2937; border-radius: 8px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; color: #60a5fa; border-bottom: 1px solid #374151; padding-bottom: 10px;}
    .card-header h3 { margin: 0; font-size: 1.3em; font-weight: 400; }
    .card-content div { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.95em; }
    .card-content span:first-child { color: #9ca3af; }
    .legend-items div { margin-bottom: 10px; display: flex; align-items: center; }
    .dot { width: 12px; height: 12px; border-radius: 50%; margin-right: 10px; }
    .dot.food { background-color: #22c55e; box-shadow: 0 0 5px #22c55e; }
    .dot.toxin { background-color: #ef4444; box-shadow: 0 0 5px #ef4444; }
    .note { font-style: italic; color: #6b7280; font-size: 0.9em; margin-top: 10px; }
    .canvas-wrapper { position: relative; border: 1px solid #374151; border-radius: 8px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.2); background-color: #000; }
    .canvas { display: block; }
    .extinction-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; text-align: center; }
    .extinction-message { color: white; } .extinction-message h3 { font-size: 2em; color: #ef4444; } .extinction-message button { margin-top: 15px; background-color: #10b981; color: white; padding: 10px 20px; border:none; border-radius: 5px; cursor: pointer; }
    .status { position: absolute; bottom: 10px; left: 10px; background-color: rgba(0,0,0,0.5); color: #9ca3af; padding: 5px 10px; border-radius: 4px; font-size: 0.85em; }
    .info-section { width: 100%; max-width: 1200px; margin-top: 30px; background-color: #1f2937; padding: 25px; border-radius: 8px; }
    .info-section h3 { text-align: center; color: #60a5fa; font-size: 1.8em; margin-bottom: 20px; font-weight: 300; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
    .info-grid h4 { color: #93c5fd; font-size: 1.1em; margin-bottom: 8px; font-weight: 400; }
    .info-grid p { color: #d1d5db; font-size: 0.95em; line-height: 1.6; margin-bottom: 0; }
    @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } .info-grid { grid-template-columns: 1fr; } .title { font-size: 2em;} .subtitle {font-size: 1em;} }
      `}</style>
    <div className="header">
      <h1 className="title">Digital Evolution</h1>
      <p className="subtitle">Watch life emerge, adapt, and thrive in a digital ecosystem</p>
    </div>
  
    <div className="controls">
      <button onClick={toggleSimulation} className={`btn ${isRunning ? 'play' : ''}`} title={isRunning ? 'Pause Simulation' : 'Start Simulation'}>
        {isRunning ? <Pause size={20} /> : <Play size={20} />}
        <span>{isRunning ? 'Pause' : 'Evolve'}</span>
      </button>
  
      <button onClick={resetSimulation} className="btn reset" title="Reset Simulation to Initial State">
        <RotateCcw size={20} />
        <span>Reset</span>
      </button>
    </div>
  
    <div className="grid">
      <div className="card population">
        <div className="card-header">
          <Users size={20} />
          <h3>Population Dynamics</h3>
        </div>
        <div className="card-content">
          <div><span>Generation:</span><span>{generation}</span></div>
          <div><span>Alive:</span><span>{population.length}</span></div>
          <div><span>Species Count:</span><span>{stats.species}</span></div>
          <div><span>Total Born:</span><span>{stats.totalBorn}</span></div>
          <div><span>Total Died:</span><span>{stats.totalDied}</span></div>
        </div>
      </div>
  
      <div className="card evolution">
        <div className="card-header">
          <Zap size={20} />
          <h3>Average Traits</h3>
        </div>
        <div className="card-content">
          <div><span>Size:</span><span>{stats.avgSize.toFixed(2)}</span></div>
          <div><span>Speed:</span><span>{stats.avgSpeed.toFixed(2)}</span></div>
          <div><span>Energy:</span><span>{stats.avgEnergy.toFixed(2)}</span></div>
        </div>
      </div>
  
      <div className="card environment">
        <div className="card-header">
          <Settings size={20} />
          <h3>Ecosystem Stats</h3>
        </div>
        <div className="card-content">
          <div><span>Temperature:</span><span>{environmentalFactors.temperature.toFixed(3)}</span></div>
          <div><span>Food Units:</span><span>{environmentRef.current?.food?.length || 0}</span></div>
          <div><span>Toxin Units:</span><span>{environmentRef.current?.toxins?.length || 0}</span></div>
        </div>
      </div>
  
      <div className="card legend">
        <div className="card-header">
          <Heart size={20} />
          <h3>World Legend</h3>
        </div>
        <div className="card-content legend-items">
          <div><div className="dot food"></div><span>Nutritious Food Particle</span></div>
          <div><div className="dot toxin"></div><span>Hazardous Toxin Particle</span></div>
          <div className="note">Organisms evolve traits and display unique colors. Observe their trails and interactions.</div>
        </div>
      </div>
    </div>
  
    <div className="canvas-wrapper">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="canvas"
      />
  
      {population.length === 0 && !isRunning && environmentRef.current.time > 0 && (
        <div className="extinction-overlay">
          <div className="extinction-message">
            <h3>Extinction Event</h3>
            <p>All organisms have perished. The ecosystem awaits new life.</p>
            <button onClick={resetSimulation}>Restart Evolution</button>
          </div>
        </div>
      )}
  
      <div className="status">
        <span>Frames: {environmentRef.current?.time || 0}</span>
      </div>
    </div>
  
    <div className="info-section">
      <h3>Understanding Digital Evolution</h3>
      <div className="info-grid">
        <div>
          <h4>🧬 Genetic Blueprint</h4>
          <p>Each organism possesses a unique genome dictating traits like size, speed, energy efficiency, sensory range, toxin resistance, reproductive strategy, lifespan, and visual appearance (hue).</p>
          <h4>🍃 Survival of the Fittest</h4>
          <p>Organisms navigate their world, seeking food to gain energy while avoiding environmental hazards like toxins and non-optimal temperatures. Those best adapted to these pressures are more likely to survive and pass on their genes.</p>
        </div>
        <div>
          <h4>🔬 Reproduction & Variation</h4>
          <p>Organisms reproduce asexually or sexually (if a mate is found), creating offspring. Genomes are inherited with a chance of mutation, introducing new variations into the population, the raw material for evolution.</p>
          <h4>✨ Emergent Complexity</h4>
          <p>Over generations, observe how populations adapt. Different species might emerge, specializing in unique strategies. Complex behaviors like flocking or predator-prey dynamics can arise spontaneously from simple rules.</p>
        </div>
      </div>
    </div>
  </div>
  );
};

export default EvolutionSimulation;