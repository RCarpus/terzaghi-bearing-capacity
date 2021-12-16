#!/usr/bin/env python
# coding: utf-8

# In[2]:


def terzaghi_bearing_capacity(cohesion, phi, depth, unit_weight, width, shape, groundwater_depth=None):
    unit_weight_water = 62.4 #constant
    
    #sets groundwater_depth outside influence zone if not passed as an argument
    if groundwater_depth == None:
        groundwater_depth = 2* (depth + width)
    
    #lookup table for Terzaghi bearing capacity factors
    N_Terzaghi = {0:[5.7,1,0],
                 1:[6,1.1,.1],
                 2:[6.3,1.2,.1],
                 3:[6.6,1.3,.2],
                 4:[7,1.5,.3],
                 5:[7.3,1.6,.4],
                 6:[7.7,1.8,.5],
                 7:[8.2,2,.6],
                 8:[8.6,2.2,.7],
                 9:[9.1,2.4,.9],
                 10:[9.6,2.7,1],
                 11:[10.2,3,1.2],
                 12:[10.8,3.3,1.4],
                 13:[11.4,3.6,1.6],
                 14:[12.1,4,1.9],
                 15:[12.9,4.4,2.2],
                 16:[13.7,4.9,2.5],
                 17:[14.6,5.5,2.9],
                 18:[15.5,6,3.3],
                 19:[16.6,6.7,3.8],
                 20:[17.7,7.4,4.4],
                 21:[18.9,8.3,5.1],
                 22:[20.3,9.2,5.9],
                 23:[21.7,10.2,6.8],
                 24:[23.4,11.4,7.9],
                 25:[25.1,12.7,9.2],
                 26:[27.1,14.2,10.7],
                 27:[29.2,15.9,12.5],
                 28:[31.6,17.8,14.6],
                 29:[34.2,20,17.1],
                 30:[37.2,22.5,20.1],
                 31:[40.4,25.3,23.7],
                 32:[44,28.5,28],
                 33:[48.1,32.2,33.3],
                 34:[52.6,36.5,39.6],
                 35:[57.8,41.4,47.3],
                 36:[63.5,47.2,56.7],
                 37:[70.1,53.8,68.1],
                 38:[77.5,61.5,82.3],
                 39:[86,70.6,99.8],
                 40:[95.7,81.3,121.5],
                 41:[106.8,93.8,148.5]}
    
    #Determine effective unit weight if groundwater is in influence zone
    if groundwater_depth <= depth:
        effective_unit_weight = unit_weight - unit_weight_water
    elif depth < groundwater_depth and groundwater_depth < depth + width:
        effective_unit_weight = unit_weight - unit_weight_water * (1 - (groundwater_depth - depth) / width)
    else:
        effective_unit_weight = unit_weight
        
    effective_stress = 0      #need to initialize or else it will be local to the if statement
    #Calculate effective stress
    if groundwater_depth >= depth:
        effective_stress = unit_weight * depth
    else:
        total_stress = unit_weight * depth
        pore_pressure = (depth - groundwater_depth) * unit_weight_water
        effective_stress = total_stress - pore_pressure

    #Determine bearing capacity factors and coefficients
    Nc = N_Terzaghi[phi][0]
    Nq = N_Terzaghi[phi][1]
    Ng = N_Terzaghi[phi][2]
        
    if shape == 'square':
        coef_1 = 1.3
        coef_2 = 1
        coef_3 = 0.4
    elif shape == 'continuous':
        coef_1 = 1
        coef_2 = 1
        coef_3 = 0.5
    elif shape == 'circular':
        coef_1 = 1.3
        coef_2 = 1
        coef_3 = 0.3
    else:
        print("For Terzaghi method, shape must be 'square', 'continuous', or 'circular'.")
        return
        
    bearing_capacity = (coef_1 * cohesion * Nc)+ (coef_2 * effective_stress * Nq) + (coef_3 * effective_unit_weight * width * Ng)
    print('Nc={} Nq={} Ng={}'.format(Nc,Nq,Ng))
    print('({} * {} * {}) + ({} * {} * {}) + ({} * {} * {} * {}) = {}'.format(
            coef_1,cohesion,Nc,coef_2,effective_stress,Nq,coef_3,effective_unit_weight,width,Ng,bearing_capacity))
    return bearing_capacity
        
    

    


# In[7]:


terzaghi_bearing_capacity(cohesion=0, phi=30, depth=3.5, unit_weight=100, width=1, shape='square', groundwater_depth=3.5)/3


# In[ ]:




