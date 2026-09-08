package domain

import "testing"

func TestDeliverySettings_DeliveryChargeFor(t *testing.T) {
	threshold := func(s string) *string { return &s }

	base := DeliverySettings{
		DeliveryCharge: "60.00",
		DeliveryZones: []DeliveryZone{
			{Division: "Dhaka", DeliveryCharge: "60.00"},
			{Division: "Chattogram", DeliveryCharge: "120.00"},
		},
	}

	cases := []struct {
		name     string
		settings DeliverySettings
		division string
		subtotal float64
		want     float64
	}{
		{"no division uses the default", base, "", 100, 60},
		{"unknown division uses the default", base, "Sylhet", 100, 60},
		{"matching zone overrides the default", base, "Chattogram", 100, 120},
		{"zone match ignores case", base, "chATTogram", 100, 120},
		{"zone match ignores surrounding space", base, "  Chattogram  ", 100, 120},
		{
			"threshold met means free delivery",
			DeliverySettings{DeliveryCharge: "60.00", FreeDeliveryThreshold: threshold("1000.00")},
			"", 1000, 0,
		},
		{
			"threshold beats a zone charge",
			DeliverySettings{
				DeliveryCharge:        "60.00",
				FreeDeliveryThreshold: threshold("1000.00"),
				DeliveryZones:         []DeliveryZone{{Division: "Chattogram", DeliveryCharge: "120.00"}},
			},
			"Chattogram", 1500, 0,
		},
		{
			"subtotal below threshold still pays",
			DeliverySettings{DeliveryCharge: "60.00", FreeDeliveryThreshold: threshold("1000.00")},
			"", 999.99, 60,
		},
		{
			"zero threshold is treated as unset",
			DeliverySettings{DeliveryCharge: "60.00", FreeDeliveryThreshold: threshold("0")},
			"", 5000, 60,
		},
		{
			// A malformed zone fee must not silently make delivery free.
			"unparseable zone fee falls back to the default",
			DeliverySettings{
				DeliveryCharge: "60.00",
				DeliveryZones:  []DeliveryZone{{Division: "Dhaka", DeliveryCharge: "not-a-number"}},
			},
			"Dhaka", 100, 60,
		},
		{
			"first matching zone wins",
			DeliverySettings{
				DeliveryCharge: "60.00",
				DeliveryZones: []DeliveryZone{
					{Division: "Dhaka", DeliveryCharge: "70.00"},
					{Division: "Dhaka", DeliveryCharge: "90.00"},
				},
			},
			"Dhaka", 100, 70,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.settings.DeliveryChargeFor(tc.division, tc.subtotal); got != tc.want {
				t.Errorf("DeliveryChargeFor(%q, %v) = %v, want %v", tc.division, tc.subtotal, got, tc.want)
			}
		})
	}
}
