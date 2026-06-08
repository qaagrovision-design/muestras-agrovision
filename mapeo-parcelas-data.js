/** Mapeo Fundo → Etapa → Campo → variedades (nombres canónicos del catálogo). Editable vía JSON en Recom. */
(function () {
    window.MAPEO_PARCELAS_DEFAULT = {
        A9: {
            E06: {
                C01: [{ nombre: 'Sekoya Pop', area: 60 }],
                C02: [{ nombre: 'Sekoya Pop', area: 56.9 }],
                C03: [{ nombre: 'Sekoya Pop', area: 47.9 }],
                C04: [{ nombre: 'Sekoya Beauty', area: 48 }],
                C05: [{ nombre: 'Sekoya Beauty', area: 47.9 }],
                C06: [
                    { nombre: 'Sekoya Beauty', area: 24 },
                    { nombre: 'Sekoya Pop', area: 15.6 }
                ]
            },
            E07: {
                C01: [{ nombre: 'Sekoya Beauty', area: 42.4 }],
                C02: [{ nombre: 'Sekoya Pop', area: 42.1 }],
                C03: [{ nombre: 'Sekoya Beauty', area: 36.8 }],
                C04: [
                    { nombre: 'Sekoya Beauty', area: 38 },
                    { nombre: 'Sekoya Pop', area: 12.7 }
                ],
                C05: [
                    { nombre: 'Bianca Blue', area: 19.1 },
                    { nombre: 'Sekoya Pop', area: 23.1 }
                ],
                C06: [{ nombre: 'Bianca Blue', area: 41.9 }],
                C07: [{ nombre: 'Sekoya Pop', area: 40.6 }]
            },
            E08: {
                C01: [{ nombre: 'Sekoya Pop', area: 46.8 }],
                C02: [{ nombre: 'Sekoya Pop', area: 46.5 }],
                C03: [{ nombre: 'Sekoya Pop', area: 52.6 }],
                C04: [{ nombre: 'Sekoya Pop', area: 49.6 }],
                C05: [{ nombre: 'Sekoya Pop', area: 38.9 }],
                C06: [{ nombre: 'Bianca Blue', area: 41.8 }]
            }
        },
        LN: {
            E02: {
                C03: ['Sekoya Pop Orgánica'],
                C04: ['Sekoya Pop Orgánica'],
                C05: ['Sekoya Pop Orgánica'],
                C06: ['Sekoya Pop Orgánica']
            }
        },
        C6: {
            E04: {
                C01: ['Atlas Blue'],
                C02: ['Atlas Blue', 'Sekoya Beauty', 'Sekoya Pop'],
                C03: ['Jupiter Blue', 'Sekoya Pop'],
                C04: ['Atlas Blue', 'Sekoya Pop'],
                C05: ['Atlas Blue', 'Jupiter Blue'],
                C06: ['Sekoya Pop'],
                C07: ['Sekoya Pop'],
                C08: ['Sekoya Pop'],
                C09: ['Sekoya Pop']
            },
            E05: {
                C01: ['Mágica'],
                C02: ['Raymi', 'Sekoya Pop'],
                C03: ['Arana', 'Kirra', 'Rosita', 'Sekoya Pop', 'Terrapin'],
                C04: ['Atlas Blue Orgánico', 'Bianca Blue'],
                C05: ['Sekoya Pop']
            }
        },
        C5: {
            E01: {
                C01: ['Mágica'],
                C03: ['Sekoya Pop'],
                C04: ['Sekoya Pop'],
                C05: ['Ventura'],
                C07: ['Emerald']
            },
            E02: {
                C01: ['Bella', 'Mágica', 'Sekoya Pop'],
                C02: [
                    'Albus (FL 11-051)', 'Avanti', 'Bianca Blue', 'Falco (FL 17-141)',
                    'FCE15-087', 'FCE18-012', 'FCE18-015', 'FCM14-057', 'FCM17-132',
                    'FL09-279', 'FL-10-179', 'FL-11-158', 'FL12-236', 'FL 19-006',
                    'Keecrisp', 'Mágica', 'Sekoya Pop'
                ],
                C03: ['Sekoya Pop', 'Ventura'],
                C04: ['Bianca Blue', 'Rosita', 'Sekoya Pop'],
                C05: ['Arana', 'Kirra', 'Sekoya Pop', 'Ventura'],
                C06: ['Bianca Blue']
            },
            E03: {
                C01: ['Ventura'],
                C02: ['Sekoya Beauty', 'Ventura'],
                C03: ['Bianca Blue', 'Sekoya Pop', 'Ventura'],
                C05: ['Ventura'],
                C06: [
                    'Atlas Blue', 'Bianca Blue', 'Colosus', 'Magnus', 'Megacrisp',
                    'Megaearly', 'Megagem', 'Megagrand', 'Megaone', 'Megastar',
                    'Regina', 'Sekoya Pop'
                ]
            }
        }
    };
}());
