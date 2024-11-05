class Hotel {
    constructor(name) {
        this.name = name;
        this.rooms = [];
        this.staff = [];
        this.budget = 10000;
        this.reputation = 5;
    }
}

class Room {
    constructor(number, type) {
        this.number = number;
        this.type = type;
        this.status = 'clean';
        this.guest = null;
    }
}

class Guest {
    constructor(name, arrivalTime, departureTime, preferences) {
        this.name = name;
        this.arrivalTime = arrivalTime;
        this.departureTime = departureTime;
        this.preferences = preferences;
    }
}

class Staff {
    constructor(name, role, salary) {
        this.name = name;
        this.role = role;
        this.salary = salary;
    }
}
